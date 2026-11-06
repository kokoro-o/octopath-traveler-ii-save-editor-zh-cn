// Build the runtime catalogue from accepted stage A exports; never read the PAK.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(project, '.local/ot2-stage-a/session-001/accepted-a');
const read = name => JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
const selected = read('selected-audit.json');
const manifest = read('manifest.json');
const ability = read('tables/AbilityData.json').rows;
const preparation = read('tables/PreparationData.json').rows;
const ailments = read('tables/AilmentData.json').rows;
const field = (row, name) => row[Object.keys(row).find(k => k === name || k.startsWith(`${name}_`))];
const effects = {};
const abilities = {};
const preparations = {};
function effect(ref) {
  if (ref === 'None' || effects[ref]) return;
  const row = ailments[ref];
  assert.ok(row, ref);
  effects[ref] = {
    calcType: field(row, 'CalcType'),
    type: field(row, 'AilmentType'),
    diseases: field(row, 'AddDisease').filter(d => field(d, 'DiseaseName') !== 'None').map(d => ({
      name: field(d, 'DiseaseName'), value: field(d, 'InvocationValue'), turn: field(d, 'InvocationTurn'),
    })),
  };
}
function abilityRef(ref) {
  if (ref === 'None' || abilities[ref]) return;
  const row = ability[ref];
  assert.ok(row, ref);
  const random = row.CommandActor.assetPath.includes('RandomSelectAbility');
  abilities[ref] = { effects: row.Ailment, target: row.TargetType, attribute: row.Attribute, random };
  for (const a of row.Ailment) if (a.AilmentName !== 'None') random ? abilityRef(a.AilmentName) : effect(a.AilmentName);
}
function preparationRef(ref) {
  if (preparations[ref]) return;
  const row = preparation[ref];
  assert.ok(row, ref);
  preparations[ref] = {
    effects: row.Ailment, enhanced: row.BuildUpAilment, time: row.TimeZoneTrigger,
    attribute: row.Attribute, random: row.IsRandom,
  };
  for (const a of [...row.Ailment, ...row.BuildUpAilment]) {
    if (a.AilmentName !== 'None') row.IsRandom ? preparationRef(a.AilmentName) : effect(a.AilmentName);
  }
}
const items = selected.map(i => {
  const r = i.raw;
  const contexts = Object.entries(preparation).filter(([, row]) => row.Material === i.rowName).map(([ref]) => ref);
  for (const a of r.Ailment) effect(a.AilmentName);
  abilityRef(r.AbilityLabel);
  contexts.forEach(preparationRef);
  return {
    id: i.id, rowName: i.rowName, zhCN: i.zhCN, en: i.en,
    editorCategory: i.editorCategory, gameCategory: i.gameCategory, equipmentCategory: r.EquipmentCategory,
    nameRef: i.nameRef, descriptionRef: i.descriptionRef, description: i.description,
    stats: i.gameCategory.endsWith('::eEQUIPMENT') ? r.EquipmentRevision : null,
    effects: r.Ailment, attributeResist: r.AttributeResist, diseaseResist: r.DiseaseResist,
    abilityRef: r.AbilityLabel, specialRef: r.SpecialItemLabel, contexts,
    target: r.TargetType, attribute: r.Attribute, useType: r.UseType, displayType: r.DisplayType,
    restrictions: [r.DisableAttackCommand, r.DisableRecoveryCommand, r.DisableReviveCommand],
  };
});
assert.equal(items.length, 956);
assert.equal(new Set(items.map(i => i.id)).size, 956);
assert.equal(items.filter(i => i.stats).length, 526);
assert.ok(items.filter(i => i.stats).every(i => Object.keys(i.stats).length === 13));
assert.equal(items.filter(i => i.description).length, 606);
const output = {
  source: {
    platform: manifest.platform, version: manifest.gameVersion, pakSha256: manifest.pakSha256,
    auditSha256: createHash('sha256').update(fs.readFileSync(path.join(source, 'selected-audit.json'))).digest('hex'),
    independentToolVerified: false, runtimeVerified: false, unknownParsedTypes: 'not-separately-counted',
  },
  items, effects, abilities, preparations,
};
const data = `${JSON.stringify(output)}\n`;
const destination = path.join(project, 'src/lib/templates/octopath-traveler-ii/saveEditor/data/items.json');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, data);
console.log(JSON.stringify({ items: items.length, equipment: 526, bytes: Buffer.byteLength(data), gzipBytes: gzipSync(data).length }));
