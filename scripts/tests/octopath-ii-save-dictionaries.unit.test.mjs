import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDictionaries } from '../lib/octopath-ii/save-dictionaries.mjs';

function fixture() {
  const monster = (ID, InvadeID, DisplayName, flags = {}) => ({ ID, InvadeID, DisplayName,
    LegendFlag: false, PartnerFlag: false, NPCFlag: false, CountMin: 3, CountMax: 5,
    DisplayLevel: 9, UnlimitedFlag: false, AbilityList: ['SUMMON'], DetailText: 'MONSTER_DETAIL', EnableProcess: false, ProcessedItem: 'None', ...flags });
  return {
    AbilitySetData: { rows: {
      ABI_SET_LRN_3090: { ID: 2427, AbilitySetID: 1181, NoBoost: 'ABI_LRN_3090_01' },
      ABI_SET_OTHER: { ID: 99, AbilitySetID: 99, NoBoost: 'NOT_USED' },
      SUMMON: { NoBoost: 'SUMMON_1' },
    } },
    AbilityData: { rows: {
      ABI_LRN_3090_01: { ID: 16936, DisplayName: 'SKILL_NAME', CostValue: 45, CostType: 'EABILITY_COST_TYPE::eMP', Detail: 'SKILL_DETAIL' },
      SUMMON_1: { DisplayName: 'SUMMON_NAME', RestrictWeapon: 'EWEAPON_CATEGORY::eBOW', Attribute: 'EATTRIBUTE_TYPE::eNONE', TargetType: 'EBATTLE_TARGET_TYPE::eENEMY_ALL', AbilityType: 'EABILITY_TYPE::ePHYSICS' },
    } },
    ItemDB: { rows: { MEAT: { ItemNameID: 'MEAT_NAME' } } },
    NPCBattleData: { rows: {
      NPC_A: { LearnAbility: 'ABI_SET_LRN_3090' }, NPC_B: { LearnAbility: 'OLD_MISSING_SET' },
      NPC_C: { LearnAbility: 'None' }, NPC_D: { LearnAbility: 'OLD_MISSING_SET' },
    } },
    GameTextZH_CN: { rows: Object.fromEntries(Object.entries({
      SKILL_NAME: '极·新月横扫', NORMAL_NAME: '刺河豚', LEGEND_NAME: '提拉', PARTNER_NAME: '伙伴',
      SKILL_DETAIL: '完整技能说明。\n第二行。', SUMMON_NAME: '毒针乱射', MONSTER_DETAIL: '毒针乱射', MEAT_NAME: '熟透的肉干',
    }).map(([key, value]) => [key, { Text: { value } }])) },
    InvadeData: { rows: {
      DUMMY: monster(0, 0, 'None'), NORMAL: monster(2455, 2459, 'NORMAL_NAME', { EnableProcess: true, ProcessedItem: 'MEAT' }),
      LEGEND: monster(5103, 5002, 'LEGEND_NAME', { LegendFlag: true, CountMin: 99, CountMax: 99 }),
      PARTNER: monster(700, 701, 'PARTNER_NAME', { PartnerFlag: true, UnlimitedFlag: true }),
      NPC: monster(33, 34, 'None', { NPCFlag: true }), UNLINKED_EFFECT: monster(2459, 2455, 'None'),
    } },
    EnemyDB: { rows: {
      ENEMY_A: { TameEnable: true, InvadeMonsterID: 'NORMAL' },
      ENEMY_B: { TameEnable: true, InvadeMonsterID: 'NORMAL' },
      NPC_ENEMY: { TameEnable: true, InvadeMonsterID: 'NPC' },
      UNCAPTURABLE: { TameEnable: false, InvadeMonsterID: 'UNLINKED_EFFECT' },
    } },
  };
}

test('learned abilities use AbilitySetID, never table ID or AbilityData.ID', () => {
  const tables = fixture(), before = structuredClone(tables), result = buildDictionaries(tables);
  assert.deepEqual(result.learnedAbilities, { 1181: { name: '极·新月横扫', abilitySetId: 1181, spCost: 45, costType: 'EABILITY_COST_TYPE::eMP', description: '完整技能说明。\n第二行。' } });
  assert.deepEqual(tables, before);
  assert.equal(result.report.learnedAbilitySources[1181].rowId, 2427);
});

test('descriptions preserve newlines and costs distinguish money and percentage SP', () => {
  for (const costType of ['EABILITY_COST_TYPE::eMONEY', 'EABILITY_COST_TYPE::eMP_RATIO']) {
    const tables = fixture(); tables.AbilityData.rows.ABI_LRN_3090_01.CostType = costType;
    const skill = buildDictionaries(tables).learnedAbilities[1181];
    assert.equal(skill.costType, costType); assert.equal(skill.spCost, 45);
    assert.equal(skill.description, '完整技能说明。\n第二行。');
  }
});

test('monster enrichment resolves rank, attack type, all skills and processed item names', () => {
  const tables = fixture();
  tables.AbilitySetData.rows.SECOND = { NoBoost: 'SUMMON_2' };
  tables.AbilityData.rows.SUMMON_2 = { ...tables.AbilityData.rows.SUMMON_1, DisplayName: 'SECOND_NAME', Attribute: 'EATTRIBUTE_TYPE::eFIRE', AbilityType: 'EABILITY_TYPE::eMAGIC' };
  tables.GameTextZH_CN.rows.SECOND_NAME = { Text: { value: '火焰' } };
  tables.InvadeData.rows.NORMAL.AbilityList.push('SECOND');
  const m = buildDictionaries(tables).monsters[2455];
  assert.equal(m.rank, 9); assert.equal(m.meatItem, '熟透的肉干');
  assert.equal(m.skillName, '毒针乱射 / 火焰');
  assert.match(m.skillDesc, /弓 \/ 敌方全体物理攻击/);
  assert.match(m.skillDesc, /火属性 \/ 敌方全体属性攻击/);
  assert.equal(buildDictionaries(tables).monsters[5103].meatItem, '');
});

test('missing processing references and unknown summary enums fail rather than inventing descriptions', () => {
  const missing = fixture(); delete missing.ItemDB.rows.MEAT;
  assert.throws(() => buildDictionaries(missing), /Missing processed item/);
  const unknown = fixture(); unknown.AbilityData.rows.SUMMON_1.AbilityType = 'EABILITY_TYPE::eUNVERIFIED';
  assert.throws(() => buildDictionaries(unknown), /Unknown enum/);
  const wrapper = fixture(); wrapper.AbilityData.rows.SUMMON_1.TargetType = 'EBATTLE_TARGET_TYPE::eSELF';
  assert.match(buildDictionaries(wrapper).monsters[2455].skillDesc, /特殊召唤行动/);
});

test('monster keys use InvadeData.ID and preserve the different InvadeID as metadata', () => {
  const result = buildDictionaries(fixture());
  assert.equal(result.monsters[2455].name, '刺河豚');
  assert.equal(result.monsters[2455].enemyId, 2455);
  assert.equal(result.monsters[2455].invadeId, 2459);
  assert.equal(result.monsters[2459], undefined);
  assert.deepEqual(result.report.counts.categories, { normal: 1, legend: 1, partner: 1 });
  assert.deepEqual(result.report.monsterSources[2455].capturableEnemyRows, ['ENEMY_A', 'ENEMY_B']);
  assert.equal(result.report.idRules.monsterRuntimeMappingVerified, false);
});

test('NPC/skill summons, dummy and unlinked rows are excluded but fully reported', () => {
  const result = buildDictionaries(fixture());
  assert.deepEqual(result.report.excludedMonsters.map(r => [r.rowName, r.reason]), [
    ['DUMMY', 'dummy'], ['NPC', 'npc-or-skill-summon'], ['UNLINKED_EFFECT', 'not-linked-to-capturable-enemy'],
  ]);
  assert.equal(result.report.excludedMonsters[1].name, null);
  assert.equal(result.monsters[0], undefined);
  assert.equal(result.monsters[33], undefined);
  assert.equal(result.monsters[-1], undefined);
});

test('missing legacy NPC skill references are audited with all referring rows', () => {
  const result = buildDictionaries(fixture());
  assert.deepEqual(result.report.unresolvedNpcLearnReferences,
    [{ reference: 'OLD_MISSING_SET', npcBattleRows: ['NPC_B', 'NPC_D'] }]);
  assert.equal(result.report.counts.npcLearnReferences, 2);
});

test('the three approved missing monster references are explicit exceptions, not inferred IDs', () => {
  const tables = fixture();
  for (const suffix of ['010', '020', '030']) tables.EnemyDB.rows[`ENE_NML_DRK_${suffix}`] = {
    TameEnable: true, InvadeMonsterID: `ENE_NML_DRK_${suffix}_INVADE`,
  };
  const result = buildDictionaries(tables);
  assert.equal(result.report.counts.approvedMissingCapturableReferences, 3);
  assert.equal(result.report.counts.monsters, 3);
  assert.equal(result.report.capturableEnemiesWithoutInvade[0].reference, 'ENE_NML_DRK_010_INVADE');
  tables.EnemyDB.rows.ENE_NML_DRK_010.InvadeMonsterID = 'DIFFERENT_MISSING_ROW';
  assert.throws(() => buildDictionaries(tables), /Missing capturable InvadeData reference/);
});

test('unapproved missing capturable references fail instead of guessing a monster ID', () => {
  const tables = fixture(); tables.EnemyDB.rows.NEW_ENEMY = { TameEnable: true, InvadeMonsterID: 'NEW_MISSING_ROW' };
  assert.throws(() => buildDictionaries(tables), /Missing capturable InvadeData reference/);
});

test('duplicate AbilitySetID and InvadeData.ID fail; duplicate InvadeID is only metadata', () => {
  const skills = fixture(); skills.AbilitySetData.rows.ABI_SET_LRN_DUP = { ...skills.AbilitySetData.rows.ABI_SET_LRN_3090 };
  assert.throws(() => buildDictionaries(skills), /Duplicate\/empty AbilitySetID/);
  const monsters = fixture(); monsters.InvadeData.rows.LEGEND.ID = 2455;
  assert.throws(() => buildDictionaries(monsters), /Duplicate InvadeData.ID/);
  const aliases = fixture(); aliases.InvadeData.rows.LEGEND.InvadeID = 2459;
  const result = buildDictionaries(aliases);
  assert.equal(result.report.duplicateInvadeIds.length, 1);
  assert.ok(result.monsters[2455] && result.monsters[5103]);
});

test('missing skill references, missing text and empty included names fail', () => {
  const skill = fixture(); skill.AbilitySetData.rows.ABI_SET_LRN_3090.NoBoost = 'MISSING';
  assert.throws(() => buildDictionaries(skill), /Missing NoBoost ability/);
  const text = fixture(); delete text.GameTextZH_CN.rows.NORMAL_NAME;
  assert.throws(() => buildDictionaries(text), /Missing text reference/);
  const empty = fixture(); empty.GameTextZH_CN.rows.NORMAL_NAME.Text.value = '';
  assert.throws(() => buildDictionaries(empty), /Empty name/);
});

test('invalid IDs, category flags and count fields fail rather than coercing values', () => {
  const id = fixture(); id.InvadeData.rows.NORMAL.ID = -1;
  assert.throws(() => buildDictionaries(id), /Invalid ID/);
  const flags = fixture(); flags.InvadeData.rows.LEGEND.PartnerFlag = true;
  assert.throws(() => buildDictionaries(flags), /Ambiguous monster category/);
  const bool = fixture(); bool.InvadeData.rows.NORMAL.NPCFlag = 0;
  assert.throws(() => buildDictionaries(bool), /Invalid bool/);
  const count = fixture(); count.InvadeData.rows.NORMAL.CountMax = 1.5;
  assert.throws(() => buildDictionaries(count), /Invalid Int32/);
});

test('hashed EnemyDB field names resolve without depending on a suffix or array index', () => {
  const tables = fixture(), enemy = tables.EnemyDB.rows.ENEMY_A;
  delete tables.EnemyDB.rows.ENEMY_A;
  tables.EnemyDB.rows.ENEMY_A = Object.fromEntries(Object.entries(enemy).map(([key, v]) => [`${key}_1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, v]));
  assert.equal(buildDictionaries(tables).monsters[2455].category, 'normal');
});
