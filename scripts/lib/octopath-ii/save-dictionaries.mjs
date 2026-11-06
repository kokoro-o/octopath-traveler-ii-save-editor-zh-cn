import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pak, digest, hashFile } from './pak.mjs';
import { table } from './uasset.mjs';
import { originalField } from './extract-and-validate.mjs';

export const DICTIONARY_TABLES = {
  AbilitySetData: 'Ability/Database/AbilitySetData',
  AbilityData: 'Ability/Database/AbilityData',
  NPCBattleData: 'Character/Database/NPCBattleData',
  InvadeData: 'Ability/Database/InvadeData',
  EnemyDB: 'Character/Database/EnemyDB',
  ItemDB: 'Item/Database/ItemDB',
  GameTextZH_CN: 'GameText/Database/GameTextZH_CN',
};
// Explicitly approved source-data exceptions. Any other missing reference is
// fatal; never substitute EnemyDB.EnemyID for a missing InvadeData.ID.
const approvedMissingInvades = {
  ENE_NML_DRK_010: 'ENE_NML_DRK_010_INVADE',
  ENE_NML_DRK_020: 'ENE_NML_DRK_020_INVADE',
  ENE_NML_DRK_030: 'ENE_NML_DRK_030_INVADE',
};
const signedId = (value, context) => {
  assert.ok(Number.isInteger(value) && value >= 0 && value <= 0x7fffffff, `Invalid ID: ${context}`);
  return value;
};
const integer = (value, context) => {
  assert.ok(Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff, `Invalid Int32: ${context}`);
  return value;
};
const bool = (value, context) => {
  assert.equal(typeof value, 'boolean', `Invalid bool: ${context}`);
  return value;
};
const sortedEntries = rows => Object.entries(rows).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
const numericKeys = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => Number(a) - Number(b)));
const weaponNames = { eNONE: '', eSWORD: '剑', eLANCE: '长枪', eDAGGER: '短剑', eAXE: '斧头', eBOW: '弓', eROD: '杖' };
const attributeNames = { eNONE: '', eFIRE: '火', eICE: '冰', eTHUNDER: '雷', eWIND: '风', eLIGHT: '光', eDARK: '暗' };
const targetNames = { eSELF: '自身', eENEMY_SINGLE: '敌方单体', eENEMY_ALL: '敌方全体', ePARTY_SINGLE: '我方单体', ePARTY_ALL: '我方全体' };
const abilityTypeNames = { ePHYSICS: '物理攻击', eMAGIC: '属性攻击', eBUFF: '增益效果', eDEBUFF: '减益效果', eHP_RECOVERY: 'HP 恢复', eMP_RECOVERY: 'SP 恢复', eOTHER: '特殊效果' };
function enumLabel(labels, value, context) {
  const key = value?.split('::')[1];
  assert.ok(Object.hasOwn(labels, key), `Unknown enum: ${context}: ${value}`);
  return labels[key];
}
function summonSummary(ability, context) {
  const weapon = enumLabel(weaponNames, ability.RestrictWeapon, context);
  const attribute = enumLabel(attributeNames, ability.Attribute, context);
  const target = enumLabel(targetNames, ability.TargetType, context);
  const type = enumLabel(abilityTypeNames, ability.AbilityType, context);
  // Partner wrapper abilities may target SELF and choose an enemy/element in
  // their actor. Do not turn that wrapper metadata into a claim of self-damage.
  const effect = target === '自身' && ['物理攻击', '属性攻击', '特殊效果'].includes(type) ? '特殊召唤行动' : `${target}${type}`;
  return [weapon, attribute ? `${attribute}属性` : '', effect].filter(Boolean).join(' / ');
}

/** Pure conversion: dictionary metadata never becomes a save-game property. */
export function buildDictionaries(tables) {
  const sets = tables.AbilitySetData.rows, abilities = tables.AbilityData.rows;
  const texts = tables.GameTextZH_CN.rows, invades = tables.InvadeData.rows;
  function textName(ref, context, required = true) {
    if (ref === 'None') {
      assert.ok(!required, `Missing name reference: ${context}`);
      return null;
    }
    assert.ok(Object.hasOwn(texts, ref), `Missing text reference: ${context}: ${ref}`);
    const value = texts[ref].Text?.value;
    assert.equal(typeof value, 'string', `Invalid text: ${context}: ${ref}`);
    if (required) assert.ok(value.trim(), `Empty name: ${context}: ${ref}`);
    return value;
  }
  const learnedAbilities = {}, learnedAbilitySources = {};
  for (const [rowName, row] of sortedEntries(sets)) {
    if (!rowName.startsWith('ABI_SET_LRN_')) continue;
    const abilitySetId = signedId(row.AbilitySetID, rowName);
    assert.ok(abilitySetId > 0 && !Object.hasOwn(learnedAbilities, abilitySetId), `Duplicate/empty AbilitySetID: ${abilitySetId}`);
    assert.ok(Object.hasOwn(abilities, row.NoBoost), `Missing NoBoost ability: ${rowName}: ${row.NoBoost}`);
    const ability = abilities[row.NoBoost], nameRef = ability.DisplayName;
    assert.ok(['EABILITY_COST_TYPE::eMP', 'EABILITY_COST_TYPE::eMONEY', 'EABILITY_COST_TYPE::eMP_RATIO'].includes(ability.CostType), `Unknown learned ability cost type: ${rowName}`);
    learnedAbilities[abilitySetId] = { name: textName(nameRef, rowName), abilitySetId,
      spCost: integer(ability.CostValue, `${rowName}.CostValue`), costType: ability.CostType,
      description: textName(ability.Detail, `${rowName}.Detail`) };
    learnedAbilitySources[abilitySetId] = { rowName, rowId: row.ID, abilitySetId, noBoost: row.NoBoost, nameRef, descriptionRef: ability.Detail, costType: ability.CostType };
  }

  const npcReferences = new Map();
  for (const [rowName, row] of sortedEntries(tables.NPCBattleData.rows)) {
    assert.equal(typeof row.LearnAbility, 'string', `Invalid LearnAbility reference: ${rowName}`);
    if (row.LearnAbility === 'None') continue;
    if (!npcReferences.has(row.LearnAbility)) npcReferences.set(row.LearnAbility, []);
    npcReferences.get(row.LearnAbility).push(rowName);
  }
  const unresolvedNpcLearnReferences = [...npcReferences].filter(([ref]) => !Object.hasOwn(sets, ref))
    .map(([reference, npcBattleRows]) => ({ reference, npcBattleRows }));

  const capturableEnemies = new Map();
  const capturableEnemiesWithoutInvade = [];
  for (const [enemyRowName, row] of sortedEntries(tables.EnemyDB.rows)) {
    if (!bool(originalField(row, 'TameEnable'), `${enemyRowName}.TameEnable`)) continue;
    const ref = originalField(row, 'InvadeMonsterID');
    if (!Object.hasOwn(invades, ref)) {
      assert.ok(Object.hasOwn(approvedMissingInvades, enemyRowName) && approvedMissingInvades[enemyRowName] === ref,
        `Missing capturable InvadeData reference: ${enemyRowName}: ${ref}`);
      capturableEnemiesWithoutInvade.push({ enemyRowName, reference: ref,
        reason: 'User-approved exclusion: missing InvadeData row; no save ID inferred from EnemyDB' });
      continue;
    }
    if (!capturableEnemies.has(ref)) capturableEnemies.set(ref, []);
    capturableEnemies.get(ref).push(enemyRowName);
  }

  const monsters = {}, monsterSources = {}, excludedMonsters = [], allIds = new Set(), invadeIds = new Map();
  const categoryCounts = { normal: 0, legend: 0, partner: 0 };
  for (const [rowName, row] of sortedEntries(invades)) {
    const enemyId = signedId(row.ID, `${rowName}.ID`), invadeId = signedId(row.InvadeID, `${rowName}.InvadeID`);
    assert.ok(!allIds.has(enemyId), `Duplicate InvadeData.ID: ${enemyId}`);
    allIds.add(enemyId);
    if (!invadeIds.has(invadeId)) invadeIds.set(invadeId, []);
    invadeIds.get(invadeId).push({ rowName, id: enemyId });
    const flags = {
      legend: bool(row.LegendFlag, `${rowName}.LegendFlag`),
      partner: bool(row.PartnerFlag, `${rowName}.PartnerFlag`),
      npc: bool(row.NPCFlag, `${rowName}.NPCFlag`),
    };
    assert.ok(Object.values(flags).filter(Boolean).length <= 1, `Ambiguous monster category: ${rowName}`);
    const enemyRows = capturableEnemies.get(rowName) ?? [];
    const category = rowName === 'DUMMY' ? null : flags.npc ? null : flags.legend ? 'legend'
      : flags.partner ? 'partner' : enemyRows.length ? 'normal' : null;
    if (category === null) {
      excludedMonsters.push({ rowName, id: enemyId, invadeId, nameRef: row.DisplayName,
        name: textName(row.DisplayName, rowName, false), flags,
        reason: rowName === 'DUMMY' ? 'dummy' : flags.npc ? 'npc-or-skill-summon' : 'not-linked-to-capturable-enemy' });
      continue;
    }
    assert.ok(enemyId > 0, `Empty monster ID: ${rowName}`);
    const countMin = integer(row.CountMin, `${rowName}.CountMin`), countMax = integer(row.CountMax, `${rowName}.CountMax`);
    assert.ok(countMin <= countMax, `Reversed count range: ${rowName}`);
    const rank = integer(row.DisplayLevel, `${rowName}.DisplayLevel`);
    assert.ok(rank >= 0 && rank <= 10, `Invalid monster rank: ${rowName}`);
    const skillSources = row.AbilityList.filter(ref => ref !== 'None').map(ref => {
      assert.ok(Object.hasOwn(sets, ref), `Missing monster ability set: ${rowName}: ${ref}`);
      const abilityRef = sets[ref].NoBoost;
      assert.ok(Object.hasOwn(abilities, abilityRef), `Missing monster ability: ${rowName}: ${abilityRef}`);
      const ability = abilities[abilityRef];
      return { setRef: ref, abilityRef, nameRef: ability.DisplayName, name: textName(ability.DisplayName, `${rowName}.${ref}`),
        summary: summonSummary(ability, `${rowName}.${ref}`) };
    });
    assert.ok(skillSources.length, `Missing monster skills: ${rowName}`);
    const officialDetail = textName(row.DetailText, `${rowName}.DetailText`, false) ?? '';
    const summaries = skillSources.map(skill => `${skill.name}：${skill.summary}`).join('\n');
    let meatItem = '', meatNameRef = null;
    if (bool(row.EnableProcess, `${rowName}.EnableProcess`) && row.ProcessedItem !== 'None') {
      assert.ok(Object.hasOwn(tables.ItemDB.rows, row.ProcessedItem), `Missing processed item: ${rowName}: ${row.ProcessedItem}`);
      meatNameRef = tables.ItemDB.rows[row.ProcessedItem].ItemNameID;
      meatItem = textName(meatNameRef, `${rowName}.ProcessedItem`);
    }
    monsters[enemyId] = {
      name: textName(row.DisplayName, rowName), enemyId, invadeId, category,
      displayLevel: rank, rank, skillName: skillSources.map(skill => skill.name).join(' / '),
      skillDesc: officialDetail && officialDetail !== skillSources.map(skill => skill.name).join('\n') ? `${officialDetail}\n${summaries}` : summaries,
      meatItem, countMin, countMax,
      unlimited: bool(row.UnlimitedFlag, `${rowName}.UnlimitedFlag`),
    };
    monsterSources[enemyId] = { rowName, nameRef: row.DisplayName, flags, capturableEnemyRows: enemyRows,
      rankField: 'InvadeData.DisplayLevel', skillSources, officialDetailRef: row.DetailText,
      processedItemRef: row.ProcessedItem, meatNameRef };
    categoryCounts[category]++;
  }
  return {
    learnedAbilities: numericKeys(learnedAbilities), monsters: numericKeys(monsters),
    report: {
      counts: {
        tables: Object.fromEntries(Object.entries(tables).map(([key, t]) => [key, Object.keys(t.rows).length])),
        learnedAbilities: Object.keys(learnedAbilities).length, monsters: Object.keys(monsters).length,
        categories: categoryCounts, excludedMonsters: excludedMonsters.length,
        npcLearnReferences: npcReferences.size, unresolvedNpcLearnReferences: unresolvedNpcLearnReferences.length,
        approvedMissingCapturableReferences: capturableEnemiesWithoutInvade.length,
      },
      idRules: {
        learnedAbilities: 'AbilitySetData.AbilitySetID (not AbilitySetData.ID or AbilityData.ID)',
        monsters: 'InvadeData.ID, as explicitly requested; InvadeID retained as metadata, never used as the dictionary key',
        monsterRuntimeMappingVerified: false,
        emptySaveSlots: 'Not dictionary entries: learned ability -1; monster { EnemyID: -1, Count: 0, Used: false }',
        countFields: 'Database CountMin/CountMax/UnlimitedFlag only; no claim that save Count=-1 means unlimited',
        skillDescriptions: 'Learned descriptions are full official text. Monster descriptions retain official InvadeData.DetailText plus summaries of NoBoost weapon/element/target/type; attack types are not enemy weaknesses or final damage formulas.',
      },
      categoryRules: {
        normal: 'Non-NPC row referenced by an EnemyDB row with TameEnable=true',
        legend: 'InvadeData.LegendFlag=true', partner: 'InvadeData.PartnerFlag=true',
        excluded: 'DUMMY, NPC/skill summons, and other rows not linked to capturable enemies',
      },
      learnedAbilitySources: numericKeys(learnedAbilitySources), monsterSources: numericKeys(monsterSources),
      unresolvedNpcLearnReferences, capturableEnemiesWithoutInvade, excludedMonsters,
      duplicateInvadeIds: [...invadeIds].filter(([, rows]) => rows.length > 1).map(([invadeId, rows]) => ({ invadeId, rows })),
      verification: { independentTool: false, inGame: false, unknownPropertyTypes: 'fatal; never silently skipped' },
    },
  };
}

/** Read-only source access; writes only the three named JSON exports. */
export async function exportDictionaries({ pakPath, controlPath, outputDir, project }) {
  const baseline = JSON.parse(fs.readFileSync(path.join(project, 'scripts/tests/fixtures/octopath-ii-stage-a-baseline.json')));
  const pakSha256 = await hashFile(pakPath);
  assert.equal(pakSha256, baseline.pakSha256, 'PAK differs from the verified Switch source');
  const control = fs.readFileSync(controlPath);
  assert.ok(control.length >= 0x3070, 'Truncated control.nacp');
  const gameVersion = control.subarray(0x3060, 0x3070).toString('utf8').replace(/\0.*$/, '');
  assert.equal(gameVersion, baseline.gameVersion, 'Unexpected game version');
  const pak = new Pak(pakPath), tables = {};
  let result, resources;
  try {
    for (const [key, resource] of Object.entries(DICTIONARY_TABLES)) tables[key] = table(pak, `Majesty/Content/${resource}`);
    result = buildDictionaries(tables);
    assert.equal(result.report.counts.learnedAbilities, 191, 'Expected the 191 verified learned abilities');
    resources = [...pak.resources.values()].sort((a, b) => a.path < b.path ? -1 : 1);
  } finally { pak.close(); }
  assert.equal(await hashFile(pakPath), pakSha256, 'PAK changed during extraction');
  assert.equal(digest(fs.readFileSync(controlPath)), digest(control), 'Control metadata changed during extraction');
  const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
  const learned = serialize(result.learnedAbilities), monsters = serialize(result.monsters);
  result.report.source = {
    platform: 'Switch', gameVersion, pakSha256, controlSha256: digest(control), resources,
    extractorSha256: digest(fs.readFileSync(fileURLToPath(import.meta.url))),
    parserSha256: digest(fs.readFileSync(new URL('./uasset.mjs', import.meta.url))),
  };
  result.report.outputSha256 = { 'learnedAbilities.json': digest(Buffer.from(learned)), 'monsters.json': digest(Buffer.from(monsters)) };
  const files = { 'learnedAbilities.json': learned, 'monsters.json': monsters, 'saveDictionaries.report.json': serialize(result.report) };
  // Validate the entire destination set before any writes. Identical reruns are
  // no-ops; a differing existing export requires an explicitly new directory.
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(outputDir, name);
    if (fs.existsSync(target)) assert.equal(fs.readFileSync(target, 'utf8'), body, `Refusing to overwrite differing export: ${target}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const target = path.join(outputDir, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, body, { flag: 'wx' });
  }
  return { ...result.report.counts, gameVersion, pakSha256, sourceUnchanged: true,
    outputDir: path.resolve(outputDir), files: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, { bytes: Buffer.byteLength(body), sha256: digest(Buffer.from(body)) }])) };
}
