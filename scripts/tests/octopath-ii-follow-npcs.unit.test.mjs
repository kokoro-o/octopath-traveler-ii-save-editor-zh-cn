import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { get } from 'svelte/store';
import { buildFollowNpcs, FOLLOW_OWNERS } from '../lib/octopath-ii/follow-npcs.mjs';
import { describeFollowSkill } from '../lib/octopath-ii/follow-skill-description.mjs';

let vite, follow, adapter, stores, component;
test.before(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-follow-npcs-qa/unit-cache' });
  follow = await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/utils/follow-npcs.ts');
  adapter = await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/utils/save-feature-store.ts');
  stores = await vite.ssrLoadModule('/src/lib/stores/index.ts');
  component = (await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/components/FollowNpcs.svelte')).default;
});
test.after(async () => { await vite?.close(); });
const empty = () => ({ NpcUniqueID: -1, SupportLimit: 0, FieldCommandType: 0, MasterCharacterID: 0 });
const fixture = () => ({ FollowNpcSaveData: [
  { NpcUniqueID: 12915, SupportLimit: 3, FieldCommandType: 7, MasterCharacterID: 4 },
  { NpcUniqueID: 13004, SupportLimit: 2, FieldCommandType: 5, MasterCharacterID: 8 },
  { NpcUniqueID: 2147483646, SupportLimit: -1, FieldCommandType: 16, MasterCharacterID: 2 }, empty(),
], FollowWaitingNpcSaveData: Array.from({ length: 4 }, empty), BackupLearnAbility: { Org_LearnAbility: [1001, -1, -1, -1, -1] }, Other: { keep: 77 } });

test('target dictionary retains unique IDs, verified names/towns and native command values', () => {
  const data = follow.followNpcCatalogue;
  assert.equal(Object.keys(data).length, 803);
  for (const [id, npc] of Object.entries(data)) {
    assert.equal(Number(id), npc.npcUniqueId); assert.ok(npc.name.trim()); assert.ok(npc.town.trim());
    assert.ok(npc.defaultSupportLimit === null || Number.isInteger(npc.defaultSupportLimit)); assert.ok(Array.isArray(npc.skillNames));
    assert.ok(npc.rank === null || Number.isInteger(npc.rank) && npc.rank >= 1 && npc.rank <= 10);
    assert.equal(npc.skills.length === 0, npc.skillNames.length === 0);
    assert.equal(Boolean(npc.skillDesc.trim()), npc.skills.length > 0);
    for (const skill of npc.skills) {
      assert.ok(skill.name.trim()); assert.ok(skill.description.trim());
      assert.equal(skill.unresolvedEffects.length, 0, `${id}: ${skill.abilityRef}`);
      assert.ok(npc.skillDesc.includes(skill.description));
    }
  }
  assert.equal(data[12915].name, '市民'); assert.equal(data[12915].town, '康宁湾'); assert.equal(data[12915].defaultSupportLimit, 4);
  assert.equal(data[13004].town, '特洛甫霍普'); assert.equal(data[22011].defaultSupportLimit, 7);
  assert.equal(FOLLOW_OWNERS[5].fieldCommandType, 10); assert.equal(FOLLOW_OWNERS[8].fieldCommandType, 5);
  assert.equal(FOLLOW_OWNERS[4].fieldCommandType, 7); assert.equal(FOLLOW_OWNERS[2].fieldCommandType, 16);
  assert.equal(follow.followOwners[7], undefined);
  assert.equal(data[201].rank, 2); assert.equal(data[12915].rank, 9);
  assert.match(data[22011].skills.find(s => s.name === '严防死守').description, /物防上升.*3回合/);
  assert.equal(follow.followCommandLabel(7), '雇佣'); assert.equal(follow.followCommandLabel(10), '引导');
  assert.equal(follow.followCommandLabel(5), '诱惑'); assert.equal(follow.followCommandLabel(16), '收服');
  assert.equal(follow.followCommandLabel(77), '未知指令（77）');
});

test('export builder merges aliases without losing provenance and resolves the longest region label', () => {
  const tables = {
    NPCData: { rows: {
      NPC_Twn_Sea_2_1_A_TALK_0100: { NPC_UnqIndex: 12915, TextLabel: 'NPC_NAME', FCmd_Lure_ID: 'LEAD' },
      NPC_Twn_Sea_2_1_A_TALK_0110: { NPC_UnqIndex: 12915, TextLabel: 'NPC_NAME', FCmd_Lure_ID: 'LEAD' },
      NPC_UNNAMED: { NPC_UnqIndex: 42, TextLabel: 'None', FCmd_Lure_ID: 'LEAD' },
    } }, NPCLeadData: { rows: { LEAD: { SupporterID: 'SUPPORT' } } },
    SupportCharacterDB: { rows: { SUPPORT: { DisplayRank: 8, SupportLimit: 4, IsUnlimitedSupporter: false, CommandTable: [{ CommandName: 'ABILITY' }] } } },
    AbilityData: { rows: { ABILITY: { DisplayName: 'SKILL_NAME', Detail: 'SKILL_DETAIL' } } },
    GameTextZH_CN: { rows: Object.fromEntries(Object.entries({ NPC_NAME: '市民', SKILL_NAME: '横向一字扫', SKILL_DETAIL: '用杖对敌方全体造成伤害。\n此处保留完整换行。', Twn_Sea_2_1: '宽泛区域', Twn_Sea_2_1_A: '康宁湾' }).map(([key, value]) => [key, { Text: { value } }])) },
  };
  const result = buildFollowNpcs(tables);
  assert.deepEqual(Object.keys(result.followNpcs), ['12915']); assert.equal(result.followNpcs[12915].town, '康宁湾');
  assert.deepEqual(result.followNpcs[12915].skillNames, ['横向一字扫']); assert.equal(result.report.sources[12915].length, 2);
  assert.equal(result.followNpcs[12915].rank, 8);
  assert.equal(result.followNpcs[12915].skills[0].description, '用杖对敌方全体造成伤害。\n此处保留完整换行。');
  assert.equal(result.followNpcs[12915].skills[0].descriptionSource, 'official');
  assert.equal(result.report.excluded[0].reason, 'unnamed-npc');
  tables.SupportCharacterDB.rows.SUPPORT.DisplayRank = 0;
  assert.equal(buildFollowNpcs(tables).followNpcs[12915].rank, null);
  tables.SupportCharacterDB.rows.SUPPORT.DisplayRank = 11;
  assert.throws(() => buildFollowNpcs(tables), /Invalid support rank/);
  tables.SupportCharacterDB.rows.SUPPORT.DisplayRank = 8;
  tables.SupportCharacterDB.rows.SECOND = { ...tables.SupportCharacterDB.rows.SUPPORT, DisplayRank: 9 };
  tables.NPCLeadData.rows.SECOND = { SupporterID: 'SECOND' };
  tables.NPCData.rows.NPC_Twn_Sea_2_1_A_TALK_0110.FCmd_Lure_ID = 'SECOND';
  assert.equal(buildFollowNpcs(tables).followNpcs[12915].rank, null);
  assert.deepEqual(buildFollowNpcs(tables).report.ambiguousRanks[0].values, [8, 9]);
});

test('support summaries retain their own targets and official status text instead of borrowing same-name guest descriptions', () => {
  const tables = {
    AbilityData: { rows: {
      SUPPORT: { DisplayName: 'NAME', Detail: 'None', TargetType: 'EBATTLE_TARGET_TYPE::eENEMY_SINGLE', RestrictWeapon: 'EWEAPON_CATEGORY::eSWORD', Ailment: [{ AilmentName: 'ADD_DEF_DOWN', InvocationTurn: 3, DiseaseRate: 50 }] },
      GUEST: { DisplayName: 'NAME', Detail: 'GUEST_DETAIL' },
    } },
    AilmentData: { rows: { ADD_DEF_DOWN: { Target: 'EAILMENT_TARGET_TYPE_OLD::NewEnumerator0', AddDisease: [{ DiseaseName: 'DEF_DOWN' }] } } },
    DiseaseData: { rows: { DEF_DOWN: { Detail: 'DEF_DOWN_DETAIL' } } },
    GameTextZH_CN: { rows: Object.fromEntries(Object.entries({ NAME: '同名技能', GUEST_DETAIL: '用剑对敌方全体造成伤害。', DEF_DOWN_DETAIL: '物防下降：增加所受物理攻击的伤害。' }).map(([key, value]) => [key, { Text: { value } }])) },
    followEffectTargets: { NewEnumerator0: 'eDEPEND' },
  };
  const skill = describeFollowSkill('SUPPORT', tables);
  assert.equal(skill.descriptionSource, 'database'); assert.match(skill.description, /敌方单体/);
  assert.match(skill.description, /物防下降.*3回合.*50%/); assert.doesNotMatch(skill.description, /敌方全体/);
  assert.equal(describeFollowSkill('GUEST', tables).description, '用剑对敌方全体造成伤害。');
  assert.deepEqual(skill.unresolvedEffects, []);
});

test('reads retain original array indices, return defensive copies and never initialize missing fields', () => {
  const data = fixture(), before = structuredClone(data), owned = follow.readCharacterFollowNpcs(data, 8);
  assert.equal(owned.current.length, 1); assert.equal(owned.current[0].index, 1); assert.equal(owned.waiting.length, 0);
  follow.readFollowNpcList(data, 'FollowNpcSaveData')[0].SupportLimit = 999;
  assert.deepEqual(data, before); assert.equal(follow.readFollowNpcList({}, 'FollowNpcSaveData'), undefined);
  assert.equal(follow.readFollowNpcList(undefined, 'FollowNpcSaveData'), undefined);
});

test('filling an empty slot uses the confirmed owner command; replacement preserves existing state', () => {
  const data = fixture(), before = structuredClone(data);
  const created = follow.setFollowNpc(data, 'FollowNpcSaveData', 3, 12915, 5);
  assert.deepEqual(created.data.FollowNpcSaveData[3], { NpcUniqueID: 12915, SupportLimit: 4, FieldCommandType: 10, MasterCharacterID: 5 });
  const replaced = follow.setFollowNpc(data, 'FollowNpcSaveData', 0, 13004, 4);
  assert.deepEqual(replaced.data.FollowNpcSaveData[0], { NpcUniqueID: 13004, SupportLimit: 3, FieldCommandType: 7, MasterCharacterID: 4 });
  assert.equal(replaced.data.FollowWaitingNpcSaveData, data.FollowWaitingNpcSaveData); assert.deepEqual(data, before);
  assert.throws(() => follow.setFollowNpc(data, 'FollowNpcSaveData', 3, 12915, 7));
  assert.throws(() => follow.setFollowNpc(data, 'FollowNpcSaveData', 1, 12915, 4), /其他角色/);
});

test('counts accept positive Int32 values, preserve unknown IDs and reject invalid or other-owner edits', () => {
  const data = fixture(), before = structuredClone(data);
  for (const value of [1, 99, 999, 2147483647]) {
    const result = follow.setFollowSupportLimit(data, 'FollowNpcSaveData', 2, value, 2);
    assert.deepEqual(result.data.FollowNpcSaveData[2], { ...data.FollowNpcSaveData[2], SupportLimit: value });
  }
  assert.equal(follow.followNpcLabel(2147483646), '未知 (ID: 2147483646)');
  assert.equal(follow.setFollowNpc(data, 'FollowNpcSaveData', 2, 2147483646, 2).changed, false);
  assert.throws(() => follow.setFollowNpc(data, 'FollowNpcSaveData', 0, 2147483646, 4));
  for (const value of [0, -1, '', '99x', 1.5, 2147483648]) assert.throws(() => follow.setFollowSupportLimit(data, 'FollowNpcSaveData', 0, value, 4));
  assert.throws(() => follow.setFollowSupportLimit(data, 'FollowNpcSaveData', 1, 99, 4));
  assert.deepEqual(data, before);
});

test('clear resets all four fields and sorting/swapping moves complete records within the selected array', () => {
  const data = fixture(), before = structuredClone(data);
  const cleared = follow.clearFollowNpcSlot(data, 'FollowNpcSaveData', 0, 4); assert.deepEqual(cleared.data.FollowNpcSaveData[0], empty());
  const moved = follow.moveFollowNpcSlot(data, 'FollowNpcSaveData', 2, 0);
  assert.deepEqual(moved.data.FollowNpcSaveData[0], before.FollowNpcSaveData[2]); assert.equal(moved.data.FollowNpcSaveData.length, 4);
  const swapped = follow.swapFollowNpcSlots(data, 'FollowNpcSaveData', 0, 1);
  assert.deepEqual(swapped.data.FollowNpcSaveData.slice(0, 2), [before.FollowNpcSaveData[1], before.FollowNpcSaveData[0]]);
  assert.equal(moved.data.FollowWaitingNpcSaveData, data.FollowWaitingNpcSaveData); assert.equal(moved.data.BackupLearnAbility, data.BackupLearnAbility);
  assert.equal(follow.moveFollowNpcSlot(data, 'FollowNpcSaveData', 0, 0).changed, false); assert.deepEqual(data, before);
  assert.throws(() => follow.moveFollowNpcSlot(data, 'FollowNpcSaveData', 0, 4));
});

test('malformed or future schemas remain untouched; accepted changes alone mark dirty', () => {
  const data = fixture(); data.FollowNpcSaveData[0].Future = 8;
  assert.equal(follow.readFollowNpcList(data, 'FollowNpcSaveData'), undefined);
  assert.throws(() => follow.clearFollowNpcSlot(data, 'FollowNpcSaveData', 0, 4)); assert.equal(data.FollowNpcSaveData[0].Future, 8);
  const valid = fixture(); stores.dataJson.set(valid); stores.isDirty.set(false);
  adapter.editSave(s => follow.setFollowSupportLimit(s, 'FollowNpcSaveData', 0, 3, 4)); assert.equal(get(stores.isDirty), false);
  assert.throws(() => adapter.editSave(s => follow.setFollowSupportLimit(s, 'FollowNpcSaveData', 0, -1, 4))); assert.equal(get(stores.isDirty), false);
  adapter.editSave(s => follow.setFollowSupportLimit(s, 'FollowNpcSaveData', 0, 999, 4)); assert.equal(get(stores.isDirty), true);
  assert.equal(get(stores.dataJson).FollowNpcSaveData[0].SupportLimit, 999);
});

test('component SSR renders four shared slots, owner restrictions and descriptions without editing the save', () => {
  const data = fixture(); stores.dataJson.set(data); stores.isDirty.set(false);
  const { html } = component.render({ characterId: 4 });
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 4);
  assert.match(html, /全队共享/); assert.match(html, /康宁湾/); assert.match(html, /未知 \(ID: 2147483646\)/);
  assert.equal((html.match(/data-slot-details="follow-npc"/g) ?? []).length, 2);
  assert.match(html, /强度：★★★★★★★★★☆ \(9星\)/); assert.match(html, /随行指令：雇佣/);
  assert.doesNotMatch(html, /指令 ID/); assert.match(html, /效果摘要/); assert.match(html, /造成光属性伤害/);
  assert.equal((html.match(/<fieldset[^>]*\sdisabled(?:\s|>)/g) ?? []).length, 2);
  assert.equal(get(stores.dataJson), data); assert.equal(get(stores.isDirty), false);
});

test('empty and unknown slots omit the entire description panel; reading every character leaves the save untouched', () => {
  const data = fixture(); data.FollowNpcSaveData = [empty(), empty(), empty(), { ...empty(), NpcUniqueID: 2147483646, MasterCharacterID: 4 }];
  stores.dataJson.set(data); stores.isDirty.set(false);
  for (const characterId of [2, 4, 5, 8]) {
    const { html } = component.render({ characterId });
    assert.doesNotMatch(html, /data-slot-details/); assert.doesNotMatch(html, /强度：|支援技能/);
    assert.equal((html.match(/without-details/g) ?? []).length, 4);
    assert.match(html, new RegExp(`空槽（填入后归属：${FOLLOW_OWNERS[characterId].name}）`));
  }
  assert.equal(get(stores.dataJson), data); assert.equal(get(stores.isDirty), false);
});
