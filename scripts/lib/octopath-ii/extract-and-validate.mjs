import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { Pak, hashFile, digest } from './pak.mjs';
import { table, enumMap, summary } from './uasset.mjs';

export const TABLES = {
  ItemDB: 'Item/Database/ItemDB', GameTextEN: 'GameText/Database/GameTextEN', GameTextZH_CN: 'GameText/Database/GameTextZH_CN',
  AilmentData: 'Ability/Database/AilmentData', DiseaseData: 'Ability/Database/DiseaseData', AbilityData: 'Ability/Database/AbilityData',
  AbilitySetData: 'Ability/Database/AbilitySetData', SupportAbilityData: 'Ability/Database/SupportAbilityData', SpecialItemDB: 'Item/Database/SpecialItemDB',
  ItemCategory: 'Item/Database/ItemCategory', EquipmentCategory: 'Item/Database/EquipmentCategory', PreparationData: 'Ability/Database/PreparationData',
  ProcessItemNum: 'Ability/Database/ProcessItemNum', DismantlingData: 'Ability/Database/DismantlingData',
};
export const ITEM_FIELDS = ['ID','ItemNameID','DetailTextID','IconLabel','ItemCategory','SortCategory','BackpackPriority','DisplayType','UseType','MaxNum','SpecialItemLabel','TargetType','Attribute','Ailment','ValuableFlag','BuyPrice','SellPrice','BuyMeetCount','SellMeetCount','EquipmentCategory','EquipmentTextureLabel','EquipmentRevision','AttributeResist','DiseaseResist','CommandEffecter','ActionCommandSequencer','TextInfoLabel','DisableAttackCommand','DisableRecoveryCommand','DisableReviveCommand','AbilityLabel','DebugRecommendLv'];
export const REVISION_FIELDS = ['HP','MP','BP','SP','POT','ATK','DEF','MATK','MDEF','ACC','EVA','CON','AGI'];
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const canonicalHash = value => digest(Buffer.from(JSON.stringify(canonical(value))));
export const active = v => v.Ailment.filter(a => a.AilmentName !== 'None');

export function inventoryFromSource(source) {
  const ast = ts.createSourceFile('resource.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decl = ast.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations).find(d => ts.isIdentifier(d.name) && d.name.text === 'inventory');
  if (!decl?.initializer || !ts.isArrayLiteralExpression(decl.initializer)) throw new Error('Inventory is not a static array');
  const items = decl.initializer.elements.map(e => {
    if (!ts.isObjectLiteralExpression(e)) throw new Error('Nonliteral inventory entry');
    const obj = {};
    for (const p of e.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) throw new Error('Nonliteral inventory property');
      const v = p.initializer;
      if (Object.hasOwn(obj, p.name.text)) throw new Error('Duplicate inventory property');
      if (ts.isNumericLiteral(v)) obj[p.name.text] = Number(v.text);
      else if (ts.isStringLiteral(v)) obj[p.name.text] = v.text;
      else throw new Error('Nonliteral inventory value');
    }
    assert.deepEqual(Object.keys(obj), ['index','type','name']);
    assert.ok(Number.isInteger(obj.index) && Number.isInteger(obj.type) && typeof obj.name === 'string');
    return { id: obj.index, editorCategory: obj.type, editorName: obj.name };
  });
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Duplicate inventory ID'); return items;
}

export function requireReference(rows, ref, context) {
  if (ref === 'None') return null;
  if (!Object.hasOwn(rows, ref)) throw new Error(`Missing reference ${context}: ${ref}`); return rows[ref];
}
export function originalField(object, base) {
  const keys = Object.keys(object).filter(k => k === base || new RegExp(`^${base}_\\d+_[A-F0-9]{32}$`).test(k));
  if (keys.length !== 1) throw new Error(`Missing/ambiguous original field ${base}`);
  return object[keys[0]];
}
export function validateSamples(items, tables, baseline, oldSources) {
  const byId = new Map(items.map(x => [x.id, x]));
  const results = baseline.samples.map(expected => {
    const item = byId.get(expected.id); assert.ok(item, `Sample ID ${expected.id}`);
    for (const key of ['rowName','nameRef','descriptionRef','zhCN','en']) assert.equal(item[key], expected[key], `Sample ${expected.id}.${key}`);
    assert.deepEqual(active(item.raw), expected.effects, `Sample ${expected.id}.effects`);
    assert.equal(item.raw.AbilityLabel, expected.abilityRef);
    if (expected.equipment.status !== 'not-applicable') {
      assert.deepEqual(item.raw.EquipmentRevision, Object.fromEntries(REVISION_FIELDS.map(k => [k, expected.equipment.nonzero[k] ?? 0])));
    }
    if (expected.context.status !== 'not-applicable') {
      const prep = tables.PreparationData.rows[expected.context.row]; assert.equal(prep.Material, item.rowName);
      assert.equal(prep.Ailment[0].InvocationValue, expected.context.ordinary); assert.equal(prep.BuildUpAilment[0].InvocationValue, expected.context.enhanced);
    }
    return { id: expected.id, passed: true, baselineSource: expected.source, equipmentStatus: expected.equipment.status };
  });
  const ambiguities = baseline.ambiguities.map(e => {
    const i = byId.get(e.id); assert.equal(i.nameRef, e.nameRef); assert.equal(oldSources.textKeys[i.editorName], e.oldTextKey);
    assert.equal(tables.GameTextEN.rows[i.nameRef].Text.key, `${e.nameRef}_Text`); assert.notEqual(`${e.nameRef}_Text`, e.oldTextKey);
    return { id: e.id, oldTextKey: e.oldTextKey, correctNameRef: i.nameRef, passed: true };
  });
  const c = baseline.classificationDifference, necklace = byId.get(c.id);
  assert.equal(necklace.editorCategory, c.editorCategory); assert.equal(necklace.gameCategory, c.gameCategory); assert.equal(necklace.rowName, c.rowName);
  assert.equal(necklace.raw.EquipmentCategory, c.equipmentCategory);
  assert.deepEqual(necklace.raw.EquipmentRevision, Object.fromEntries(REVISION_FIELDS.map(k => [k, c.nonzero[k] ?? 0])));
  const cases = baseline.textCases;
  for (const id of cases.sharedDescription.ids) assert.equal(byId.get(id).descriptionRef, cases.sharedDescription.ref);
  assert.equal(byId.get(cases.emptyDescription.id).descriptionRef, cases.emptyDescription.ref); assert.equal(byId.get(cases.emptyDescription.id).description, '');
  assert.equal(byId.get(cases.noneDescription.id).descriptionRef, 'None'); assert.equal(byId.get(cases.noneDescription.id).description, null);
  return { fixedSamples: results, ambiguities, classificationDifference: { ...c, passed: true }, sharedEmptyNone: { passed: true, cases } };
}

// Separate scalar/tag walk over original bytes: compares parser output to serialized values,
// names, types and positions. It is a consistency check, not an independent UE tool.
export function auditEquipment(items, itemTable, bytes, names) {
  const report = { equipmentCount: 0, originalItemFieldCount: 0, parsedItemFieldCount: 0, originalRevisionFieldCount: 0, parsedRevisionFieldCount: 0, zeroValues: 0, negativeValues: 0, arraysChecked: 0, arrayElementsChecked: 0, missingFields: [], unknownFields: [], anomalousValues: [], failedEquipmentIds: [], anomalyScope: 'Serialized type/bounds, finite signed integers and structural consistency; no guessed semantic stat limits.', fields: Object.fromEntries(REVISION_FIELDS.map(k => [k, { raw: 0, parsed: 0, zero: 0, negative: 0, min: null, max: null }])), equipment: [] };
  const rawName = pos => { const index = bytes.readInt32LE(pos), number = bytes.readInt32LE(pos + 4); if (index < 0 || index >= names.length || number !== 0) throw new Error('Unexpected audit FName'); return names[index]; };
  for (const item of items.filter(i => i.gameCategory === 'EItemCategoryData::eEQUIPMENT')) {
    const fields = itemTable.layouts[item.rowName].fields, revision = fields.find(f => f.name === 'EquipmentRevision');
    const audit = { id: item.id, rowName: item.rowName, editorCategory: item.editorCategory, gameCategory: item.gameCategory, fields: [], arrays: [] };
    try {
      assert.deepEqual(fields.map(f => f.name), ITEM_FIELDS);
      for (const f of fields) {
        report.originalItemFieldCount++; assert.equal(rawName(f.offset), f.name); assert.equal(rawName(f.offset + 8), f.type);
        assert.equal(bytes.readInt32LE(f.offset + 16), f.size); assert.equal(bytes.readInt32LE(f.offset + 20), f.arrayIndex);
        assert.equal(digest(bytes.subarray(f.payloadOffset, f.end)), f.payloadSha256); report.parsedItemFieldCount++;
      }
      assert.equal(revision.type, 'StructProperty'); assert.equal(revision.metadata.struct, 'CharacterParam');
      let pos = revision.payloadOffset, index = 0;
      while (rawName(pos) !== 'None') {
        const key = rawName(pos), kind = rawName(pos + 8), size = bytes.readInt32LE(pos + 16), arrayIndex = bytes.readInt32LE(pos + 20);
        report.originalRevisionFieldCount++; if (!REVISION_FIELDS.includes(key)) report.unknownFields.push({ id: item.id, key });
        assert.equal(key, REVISION_FIELDS[index]); assert.equal(kind, 'IntProperty'); assert.equal(size, 4); assert.equal(arrayIndex, 0); assert.equal(bytes[pos + 24], 0);
        const value = bytes.readInt32LE(pos + 25), parsed = revision.children[index];
        assert.equal(parsed.name, key); assert.equal(parsed.type, kind); assert.equal(parsed.offset, pos); assert.equal(parsed.payloadOffset, pos + 25); assert.equal(parsed.end, pos + 29);
        assert.equal(value, item.raw.EquipmentRevision[key]); assert.equal(parsed.payloadSha256, digest(bytes.subarray(pos + 25, pos + 29)));
        const stat = report.fields[key]; stat.raw++; stat.parsed++; stat.zero += value === 0 ? 1 : 0; stat.negative += value < 0 ? 1 : 0;
        stat.min = stat.min === null ? value : Math.min(stat.min, value); stat.max = stat.max === null ? value : Math.max(stat.max, value);
        report.zeroValues += value === 0 ? 1 : 0; report.negativeValues += value < 0 ? 1 : 0; report.parsedRevisionFieldCount++;
        audit.fields.push({ name: key, type: kind, order: index, value, payloadOffset: pos + 25 }); pos += 29; index++;
      }
      assert.equal(index, 13); assert.equal(revision.children.length, 13); assert.equal(pos + 8, revision.end);
      for (const key of ['Ailment','AttributeResist','DiseaseResist']) {
        const field = fields.find(f => f.name === key), values = item.raw[key], count = bytes.readInt32LE(field.payloadOffset);
        assert.equal(count, values.length); assert.equal(count, field.metadata.count);
        if (key === 'AttributeResist') { assert.equal(count, 7); for (let j = 0; j < count; j++) assert.equal(rawName(field.payloadOffset + 4 + j * 8), values[j]); }
        else if (key === 'DiseaseResist') { assert.equal(count, 12); for (let j = 0; j < count; j++) { assert.ok(bytes[field.payloadOffset + 4 + j] <= 1); assert.equal(!!bytes[field.payloadOffset + 4 + j], values[j]); } }
        else {
          assert.equal(count, 4); assert.equal(field.children.length, count);
          field.children.forEach((child, j) => {
            assert.deepEqual(child.map(f => f.name), ['AilmentName','InvocationValue','InvocationTurn','DiseaseRate']);
            for (const f of child) { assert.equal(rawName(f.offset), f.name); assert.equal(rawName(f.offset + 8), f.type); assert.equal(f.type, f.name === 'AilmentName' ? 'NameProperty' : 'IntProperty'); assert.equal(f.name === 'AilmentName' ? rawName(f.payloadOffset) : bytes.readInt32LE(f.payloadOffset), values[j][f.name]); }
          });
        }
        report.arraysChecked++; report.arrayElementsChecked += count; audit.arrays.push({ name: key, count, orderVerified: true, payloadSha256: field.payloadSha256 });
      }
      audit.passed = true;
    } catch (e) { audit.passed = false; audit.error = e.message; report.failedEquipmentIds.push(item.id); const missing = REVISION_FIELDS.filter(k => !Object.hasOwn(item.raw.EquipmentRevision, k)); report.missingFields.push(...missing.map(name => ({ id: item.id, name }))); report.anomalousValues.push({ id: item.id, error: e.message }); }
    report.equipmentCount++; report.equipment.push(audit);
  }
  return report;
}

export async function extract({ pakPath, controlPath, project, output }) {
  const allowed = fs.realpathSync(path.join(project, '.local/ot2-stage-a'));
  const destination = path.resolve(output), parent = path.dirname(destination);
  if (!destination.startsWith(allowed + path.sep)) throw new Error('Output must be within .local/ot2-stage-a');
  let ancestor = parent; while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const actualAncestor = fs.realpathSync(ancestor);
  if (actualAncestor !== allowed && !actualAncestor.startsWith(allowed + path.sep)) throw new Error('Output symlink escapes authorized directory');
  fs.mkdirSync(parent, { recursive: true });
  if (fs.realpathSync(parent) !== allowed && !fs.realpathSync(parent).startsWith(allowed + path.sep)) throw new Error('Output parent escapes authorized directory');
  fs.mkdirSync(destination); // exclusive: never overwrite an existing run
  const baselinePath = path.join(project, 'scripts/tests/fixtures/octopath-ii-stage-a-baseline.json'), baseline = JSON.parse(fs.readFileSync(baselinePath));
  const pakHash = await hashFile(pakPath); assert.equal(pakHash, baseline.pakSha256, 'Unapproved PAK hash');
  const control = fs.readFileSync(controlPath), version = control.subarray(0x3060, 0x3070).toString().replace(/\0.*$/, ''); assert.equal(version, baseline.gameVersion);
  const u = path.join(project, 'src/lib/templates/octopath-traveler-ii/saveEditor/utils');
  const whitelist = inventoryFromSource(fs.readFileSync(path.join(u, 'resource.ts'), 'utf8')), oldSources = JSON.parse(fs.readFileSync(path.join(u, 'zh-CN.sources.json')));
  assert.equal(whitelist.length, baseline.counts.items);
  const pak = new Pak(pakPath), tables = {}, tableHashes = {};
  try {
    const tableDir = path.join(destination, 'tables'); fs.mkdirSync(tableDir);
    for (const [key, resource] of Object.entries(TABLES)) {
      tables[key] = table(pak, `Majesty/Content/${resource}`);
      tableHashes[key] = canonicalHash(tables[key]);
      fs.writeFileSync(path.join(tableDir, `${key}.json`), JSON.stringify(tables[key]) + '\n');
    }
    const enums = {};
    for (const k of ['EAILMENT_CALC_TYPE_OLD','EAILMENT_TYPE','EAILMENT_TARGET_TYPE_OLD','EAILMENT_ATTRIBUTE_TYPE']) enums[k] = enumMap(pak, `Majesty/Content/Ability/BP/Enum/${k}`);
    const ids = new Map(); for (const [rowName, raw] of Object.entries(tables.ItemDB.rows)) { if (ids.has(raw.ID)) throw new Error(`Duplicate game ID ${raw.ID}`); assert.deepEqual(Object.keys(raw), ITEM_FIELDS, `Unknown/reordered ItemDB schema ${rowName}`); ids.set(raw.ID, { rowName, raw }); }
    assert.equal(ids.size, baseline.counts.itemDB);
    const items = whitelist.map(w => {
      const row = ids.get(w.id); if (!row) throw new Error(`Missing item ID ${w.id}`);
      const raw = row.raw, en = requireReference(tables.GameTextEN.rows, raw.ItemNameID, 'EN name')?.Text.value, zhCN = requireReference(tables.GameTextZH_CN.rows, raw.ItemNameID, 'CN name')?.Text.value;
      assert.equal(en, w.editorName, `English identity mismatch ${w.id}`); assert.ok(zhCN?.trim());
      const description = requireReference(tables.GameTextZH_CN.rows, raw.DetailTextID, 'CN description')?.Text.value ?? null;
      requireReference(tables.GameTextEN.rows, raw.DetailTextID, 'EN description');
      for (const ailment of active(raw)) requireReference(tables.AilmentData.rows, ailment.AilmentName, `item ${w.id} ailment`);
      requireReference(tables.AbilityData.rows, raw.AbilityLabel, `item ${w.id} ability`); requireReference(tables.SpecialItemDB.rows, raw.SpecialItemLabel, `item ${w.id} special`);
      return { ...w, ...row, gameCategory: raw.ItemCategory, nameRef: raw.ItemNameID, descriptionRef: raw.DetailTextID, en, zhCN, description, sourcePath: tables.ItemDB.path, parameterMeaning: 'raw; no unverified percentage/multiplier/formula interpretation' };
    });
    const referenceChecks = [];
    const visited = new Set();
    const checkEffect = (label, context) => {
      if (label === 'None' || visited.has(`effect:${label}`)) return;
      const effect = requireReference(tables.AilmentData.rows, label, context); visited.add(`effect:${label}`);
      referenceChecks.push({ kind: 'effect', label, context });
      for (const disease of originalField(effect, 'AddDisease')) {
        const diseaseName = originalField(disease, 'DiseaseName');
        if (diseaseName !== 'None') { requireReference(tables.DiseaseData.rows, diseaseName, label); referenceChecks.push({ kind:'disease', label:diseaseName, context:label }); }
      }
    };
    const checkAbility = (label, context) => {
      if (label === 'None' || visited.has(`ability:${label}`)) return;
      const ability = requireReference(tables.AbilityData.rows, label, context); visited.add(`ability:${label}`); referenceChecks.push({ kind:'ability', label, context });
      const random = ability.CommandActor.assetPath.includes('RandomSelectAbility');
      for (const a of active(ability)) { if (random) checkAbility(a.AilmentName, label); else checkEffect(a.AilmentName, label); }
    };
    const checkPreparation = (label, context) => {
      if (label === 'None' || visited.has(`preparation:${label}`)) return;
      const prep = requireReference(tables.PreparationData.rows, label, context); visited.add(`preparation:${label}`);
      referenceChecks.push({ kind:'preparation', label, context, randomBranches:prep.IsRandom });
      for (const a of [...active(prep), ...prep.BuildUpAilment.filter(a => a.AilmentName !== 'None')]) {
        if (prep.IsRandom) checkPreparation(a.AilmentName, label); else checkEffect(a.AilmentName, label);
      }
    };
    for (const item of items) {
      for (const a of active(item.raw)) checkEffect(a.AilmentName, `item:${item.id}`);
      checkAbility(item.raw.AbilityLabel, `item:${item.id}`);
      if (item.raw.SpecialItemLabel !== 'None') { const s = tables.SpecialItemDB.rows[item.raw.SpecialItemLabel]; requireReference(tables.ItemDB.rows, s.RelativeItemLabel, item.raw.SpecialItemLabel); }
      for (const [row, prep] of Object.entries(tables.PreparationData.rows).filter(([,v]) => v.Material === item.rowName)) {
        checkPreparation(row, `item:${item.id}`);
      }
    }
    const sampleResults = validateSamples(items, tables, baseline, oldSources);
    const equipment = auditEquipment(items, tables.ItemDB, pak.extract(`${tables.ItemDB.path}.uexp`), summary(pak.extract(`${tables.ItemDB.path}.uasset`)).names);
    assert.equal(equipment.equipmentCount, 526); assert.equal(equipment.originalRevisionFieldCount, 6838); assert.equal(equipment.parsedRevisionFieldCount, 6838); assert.deepEqual(equipment.failedEquipmentIds, []);
    const selectedIds = new Set(items.map(i => i.id)), unlisted = [...ids].filter(([id]) => !selectedIds.has(id)).map(([id, v]) => ({ id, rowName: v.rowName, gameCategory: v.raw.ItemCategory, nameRef: v.raw.ItemNameID, editable: false }));
    const count = { items: items.length, itemDB: ids.size, equipment: equipment.equipmentCount, editorEquipment: items.filter(i => i.editorCategory >= 1 && i.editorCategory <= 10).length, nonemptyDescriptions: items.filter(i => i.description?.trim()).length, unlisted: unlisted.length };
    assert.deepEqual(count, baseline.counts);
    const fieldsToReview = ['EquipmentRevision: native internal parameter semantics','Ailment: InvocationValue/InvocationTurn/DiseaseRate','AilmentData: CalcType/AddDisease/AdvValue*','DiseaseData: stacking and resistance','AbilityData: random branch weights and runtime execution','PreparationData: enhancement/day-night runtime rules','SpecialItemDB: state-dependent usability'];
    const extractorSources = {};
    for (const file of ['scripts/octopath-ii-items.mjs','scripts/lib/octopath-ii/pak.mjs','scripts/lib/octopath-ii/uasset.mjs','scripts/lib/octopath-ii/extract-and-validate.mjs']) extractorSources[file] = await hashFile(path.join(project, file));
    const manifest = { format: 'ot2-stage-a-audit-v1', extractorVersion: 'stage-a-v1', extractorSources, platform: 'Switch', gameVersion: version, engineBranch: 'UE4.27 (prior binary inspection; patch unconfirmed)', pakSha256: pakHash, controlSha256: digest(control), baselineSha256: await hashFile(baselinePath), resourceDefinitionSha256: await hashFile(path.join(u, 'resource.ts')), pak: pak.info, resources: [...pak.resources.values()].sort((a,b) => a.path.localeCompare(b.path)), tableHashes, enumHashes: Object.fromEntries(Object.entries(enums).map(([k,v]) => [k, canonicalHash(v)])) };
    const report = { counts: count, sampleResults, referenceChecks, equipmentSummary: { ...equipment, equipment: undefined }, descriptionStates: { nonempty: count.nonemptyDescriptions, empty: items.filter(i => i.description === '').length, none: items.filter(i => i.description === null).length }, unknownParsedTypes: [], independentToolVerification: { completed: false, reason: 'No second UE parser installed or run; expressly deferred. Unit tests, raw-byte walks and repeat runs are not independent-tool verification.', requiredBeforeStageBRelease: true, tables: Object.keys(TABLES), fieldsToReview }, runtimeGameVerification: false, stage: 'A only; no runtime application database or interface generated' };
    const files = { 'manifest.json': manifest, 'validation.json': report, 'equipment-fields.json': equipment, 'selected-audit.json': items, 'unlisted-audit.json': unlisted, 'enums.json': enums };
    const hashes = {};
    for (const [name, data] of Object.entries(files)) { fs.writeFileSync(path.join(destination, name), JSON.stringify(data, null, 2) + '\n'); hashes[name] = canonicalHash(data); }
    hashes.tables = canonicalHash(tableHashes);
    fs.writeFileSync(path.join(destination, 'normalized-hashes.json'), JSON.stringify(hashes, null, 2) + '\n');
    fs.writeFileSync(path.join(destination, 'report.md'), `# Stage A extraction audit\n\nCounts: ${JSON.stringify(count)}\n\nEquipment revision fields: ${equipment.parsedRevisionFieldCount}/${equipment.originalRevisionFieldCount}; zero=${equipment.zeroValues}; negative=${equipment.negativeValues}. See equipment-fields.json for every ID and field.\n\nFixed samples: ${sampleResults.fixedSamples.length}; ambiguities: ${sampleResults.ambiguities.length}.\n\nOriginal descriptions preserved; empty and None distinguished.\n\nNo independent UE tool verification and no in-game runtime verification. No application source changed. See validation.json and manifest.json.\n`);
    assert.equal(await hashFile(pakPath), pakHash, 'PAK changed during extraction');
    return { count, hashes, output: destination, resourceFiles: manifest.resources.length };
  } finally { pak.close(); }
}
