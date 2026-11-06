import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { get } from 'svelte/store';

let vite, learned, monsters, state, adapter, stores, Gvas, dragModule;
test.before(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-save-features-qa/unit-cache' });
  const load = name => vite.ssrLoadModule(`/src/lib/templates/octopath-traveler-ii/saveEditor/utils/${name}.ts`);
  learned = await load('learned-abilities'); monsters = await load('captured-monsters');
  state = await load('save-feature-state'); adapter = await load('save-feature-store');
  dragModule = await load('slot-drag');
  stores = await vite.ssrLoadModule('/src/lib/stores/index.ts');
  await vite.ssrLoadModule('/src/lib/utils/prototype.ts');
  Gvas = (await vite.ssrLoadModule('/src/lib/utils/gvas/index.ts')).default;
});
test.after(async () => { await vite?.close(); });
const empty = () => ({ EnemyID: -1, Count: 0, Used: false });
const fixture = () => ({ LearnAbilityList: [1181, 1173, 1147, 1115, 1249],
  BackupLearnAbility: { Org_LearnAbility: [1001, -1, -1, -1, 2147483646], Keep: 9 },
  TameMonsterList: Array.from({ length: 10 }, empty), LegendMonsterList: Array.from({ length: 10 }, empty),
  Unrelated: new Map([['keep', { a: 1 }]]) });

test('reads are defensive copies and never initialize absent or malformed arrays', () => {
  const data = fixture(), before = structuredClone(data);
  learned.readLearnAbilityList(data).push(1001);
  learned.readBackupLearnAbilities(data).pop();
  monsters.readMonsterList(data, 'TameMonsterList')[0].Count = 999;
  assert.deepEqual(data, before);
  assert.equal(learned.readLearnAbilityList({}), undefined);
  assert.equal(learned.readBackupLearnAbilities({}), undefined);
  assert.equal(monsters.readMonsterList({ TameMonsterList: [empty()] }, 'TameMonsterList'), undefined);
  assert.throws(() => learned.appendLearnedSlot({}), /缺少有效/);
});

test('normal edits, clear, append and confirmed shrink never touch the backup', () => {
  const data = fixture(), before = structuredClone(data);
  let result = learned.setLearnedAbility(data, 0, 1001);
  result = learned.appendLearnedSlot(result.data);
  result = learned.appendLearnedSlot(result.data);
  assert.equal(result.data.LearnAbilityList.length, 7);
  assert.equal(result.data.LearnAbilityList.at(-1), -1);
  assert.throws(() => learned.removeLearnedSlot(result.data, 0), /需要先确认/);
  assert.throws(() => learned.resizeLearnedSlots(result.data, 5), /需要先确认/);
  result = learned.removeLearnedSlot(result.data, 0, true);
  result = learned.resizeLearnedSlots(result.data, 5, true);
  result = learned.setLearnedAbility(result.data, 0, -1);
  assert.equal(result.data.BackupLearnAbility, data.BackupLearnAbility);
  assert.deepEqual(result.data.BackupLearnAbility, before.BackupLearnAbility);
  assert.deepEqual(data, before);
  assert.equal(result.data.Unrelated, data.Unrelated);
});

test('unknown imported skills survive no-ops and resize but new unknown IDs are rejected', () => {
  const data = fixture(); data.LearnAbilityList[0] = 2147483646;
  assert.equal(learned.learnedAbilityLabel(2147483646), '未知 (ID: 2147483646)');
  assert.equal(learned.setLearnedAbility(data, 0, 2147483646).changed, false);
  assert.equal(learned.appendLearnedSlot(data).data.LearnAbilityList[0], 2147483646);
  assert.throws(() => learned.setLearnedAbility(data, 1, 2147483646), /AbilitySetID/);
  assert.throws(() => learned.setLearnedAbility(data, 0, 2427), /AbilitySetID/);
});

test('only explicit confirmed backup operations copy arrays, preserving unknown IDs and sibling fields', () => {
  const data = fixture();
  assert.throws(() => learned.syncToBackup(data), /需要先确认/);
  assert.throws(() => learned.restoreFromBackup(data), /需要先确认/);
  const sync = learned.syncToBackup(data, true);
  assert.deepEqual(sync.data.BackupLearnAbility.Org_LearnAbility, data.LearnAbilityList);
  assert.notEqual(sync.data.BackupLearnAbility.Org_LearnAbility, data.LearnAbilityList);
  assert.equal(sync.data.BackupLearnAbility.Keep, 9);
  const restore = learned.restoreFromBackup(data, true);
  assert.deepEqual(restore.data.LearnAbilityList, data.BackupLearnAbility.Org_LearnAbility);
  assert.notEqual(restore.data.LearnAbilityList, data.BackupLearnAbility.Org_LearnAbility);
  assert.equal(restore.data.BackupLearnAbility, data.BackupLearnAbility);
});

test('monster edits preserve unknown IDs, count sentinels and the other list; clear resets exactly three fields', () => {
  const data = fixture(); data.TameMonsterList[0] = { EnemyID: 2147483646, Count: -1, Used: true };
  const before = structuredClone(data);
  let result = monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { Count: 999 });
  assert.deepEqual(result.data.TameMonsterList[0], { EnemyID: 2147483646, Count: 999, Used: true });
  result = monsters.updateMonsterSlot(result.data, 'TameMonsterList', 0, { EnemyID: 2455 });
  assert.equal(result.data.TameMonsterList[0].Count, 999);
  assert.equal(result.data.TameMonsterList[0].Used, true);
  result = monsters.clearMonsterSlot(result.data, 'TameMonsterList', 0);
  assert.deepEqual(result.data.TameMonsterList[0], empty());
  assert.equal(result.data.TameMonsterList.length, 10);
  assert.equal(result.data.LegendMonsterList, data.LegendMonsterList);
  assert.deepEqual(data, before);
});

test('monster choices enforce categories while untouched off-category imported records survive', () => {
  const data = fixture();
  assert.throws(() => monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { EnemyID: 5103 }), /分类/);
  assert.throws(() => monsters.updateMonsterSlot(data, 'LegendMonsterList', 0, { EnemyID: 2455 }), /分类/);
  assert.throws(() => monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { EnemyID: 2147483646 }), /分类/);
  assert.equal(monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { EnemyID: 2001 }).data.TameMonsterList[0].EnemyID, 2001);
  assert.equal(monsters.updateMonsterSlot(data, 'LegendMonsterList', 0, { EnemyID: 5103 }).data.LegendMonsterList[0].EnemyID, 5103);
  data.TameMonsterList[0].EnemyID = 5103;
  assert.equal(monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { Count: 99 }).data.TameMonsterList[0].EnemyID, 5103);
});

test('invalid input, out-of-range indices and unsupported monster schemas cannot mutate data', () => {
  for (const invalid of ['', '99x', '1.5', '1e2', NaN, Infinity, 2147483648]) assert.throws(() => state.int32(invalid));
  assert.equal(state.int32('-1'), -1); assert.equal(state.int32('999'), 999);
  const data = fixture(), before = structuredClone(data);
  assert.throws(() => learned.setLearnedAbility(data, 99, 1001));
  assert.throws(() => monsters.updateMonsterSlot(data, 'TameMonsterList', -1, { Count: 3 }));
  assert.throws(() => monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { Used: 1 }));
  assert.throws(() => monsters.updateMonsterSlot(data, 'TameMonsterList', 0, { Strength: 99 }));
  assert.deepEqual(data, before);
  data.TameMonsterList[0].FutureField = 17;
  assert.equal(monsters.readMonsterList(data, 'TameMonsterList'), undefined);
  assert.throws(() => monsters.clearMonsterSlot(data, 'TameMonsterList', 0));
  assert.equal(data.TameMonsterList[0].FutureField, 17);
});

test('global dirty state changes only for accepted mutations; read, no-op and errors preserve it', () => {
  const data = fixture(); stores.dataJson.set(data); stores.isDirty.set(false);
  adapter.editSave(s => learned.setLearnedAbility(s, 0, 1181));
  assert.equal(get(stores.isDirty), false);
  assert.throws(() => adapter.editSave(s => learned.setLearnedAbility(s, 0, 999999)));
  assert.equal(get(stores.isDirty), false); assert.equal(get(stores.dataJson), data);
  adapter.editSave(learned.appendLearnedSlot);
  assert.equal(get(stores.isDirty), true);
  assert.equal(get(stores.dataJson).LearnAbilityList.length, 6);
  assert.deepEqual(get(stores.dataJson).BackupLearnAbility, data.BackupLearnAbility);
});

test('slot moves preserve unknown IDs and complete monster records without changing backups or source arrays', () => {
  const data = fixture(); data.LearnAbilityList[0] = 2147483646;
  data.TameMonsterList[0] = { EnemyID: 2147483645, Count: -1, Used: true };
  data.TameMonsterList[1] = { EnemyID: 2455, Count: 999, Used: false };
  const before = structuredClone(data);
  const skillMove = learned.moveLearnedSlot(data, 0, 4);
  assert.deepEqual(skillMove.data.LearnAbilityList, [1173, 1147, 1115, 1249, 2147483646]);
  assert.equal(skillMove.data.BackupLearnAbility, data.BackupLearnAbility);
  const monsterMove = monsters.moveMonsterSlot(data, 'TameMonsterList', 0, 1);
  assert.deepEqual(monsterMove.data.TameMonsterList.slice(0, 2), [before.TameMonsterList[1], before.TameMonsterList[0]]);
  assert.equal(monsterMove.data.LegendMonsterList, data.LegendMonsterList);
  assert.equal(monsterMove.data.TameMonsterList.length, 10);
  assert.deepEqual(data, before);
  assert.equal(learned.moveLearnedSlot(data, 0, 0).changed, false);
  assert.equal(monsters.moveMonsterSlot(data, 'TameMonsterList', 0, 0).changed, false);
  assert.equal(monsters.moveMonsterSlot(fixture(), 'LegendMonsterList', 0, 9).changed, false);
  assert.throws(() => learned.moveLearnedSlot(data, -1, 0));
  assert.throws(() => monsters.moveMonsterSlot(data, 'TameMonsterList', 0, 10));
  stores.dataJson.set(data); stores.isDirty.set(false);
  adapter.editSave(s => learned.moveLearnedSlot(s, 0, 0)); assert.equal(get(stores.isDirty), false);
  adapter.editSave(s => learned.moveLearnedSlot(s, 0, 1)); assert.equal(get(stores.isDirty), true);
});

test('cost labels distinguish fixed SP, money and percent SP', () => {
  assert.equal(learned.learnedAbilityCostLabel(learned.learnedAbilityCatalogue[1181]), 'SP 45');
  assert.equal(learned.learnedAbilityCostLabel(learned.learnedAbilityCatalogue[1209]), '叶币 500');
  assert.equal(learned.learnedAbilityCostLabel(learned.learnedAbilityCatalogue[1223]), 'SP 100%');
});

function dragEvent() {
  const data = new Map();
  return { target: null, dataTransfer: { effectAllowed: '', dropEffect: '',
    setData: (type, value) => data.set(type, value), getData: type => data.get(type) ?? '', get types() { return [...data.keys()]; } },
  preventDefault() {}, stopPropagation() {} };
}
test('drag session accepts same-list moves and rejects cross-list, external and stale-data drops', () => {
  const session = dragModule.createSlotDrag(), event = dragEvent(), rows = [1, 2, 3], moves = [];
  assert.equal(session.start(event, 'normal', 0, rows), true);
  assert.equal(session.over(event, 'normal'), true);
  assert.deepEqual(moves, []);
  assert.equal(session.drop(event, 'normal', 2, rows, (...args) => moves.push(args)), true);
  assert.deepEqual(moves, [[0, 2]]);
  session.start(event, 'normal', 0, rows);
  assert.equal(session.over(event, 'legend'), false);
  assert.equal(session.drop(event, 'legend', 1, rows, () => assert.fail()), false);
  session.start(event, 'normal', 0, rows);
  assert.equal(session.drop(event, 'normal', 1, [9, 2, 3], () => assert.fail()), false);
  session.start(event, 'normal', 0, rows);
  assert.equal(session.drop(dragEvent(), 'normal', 1, rows, () => assert.fail()), false);
  session.start(event, 'normal', 0, rows); session.clear();
  assert.equal(session.drop(event, 'normal', 1, rows, () => assert.fail()), false);
});

for (const file of ['.local/test-saves/MJSaveData2', 'tests/saves/octopath-traveler-ii/steam/SaveData0.sav']) {
  test(`${file}: no-edit and full feature changes survive complete GVAS roundtrips`, { skip: file.startsWith('.local/') && !fs.existsSync(file) ? 'Optional private Switch fixture is not installed' : false }, () => {
    const bytes = fs.readFileSync(file), hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const g = new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)), original = g.parseToJson();
    const parse = buffer => new Gvas(new DataView(buffer)).parseToJson();
    learned.readLearnAbilityList(original); learned.readBackupLearnAbilities(original);
    monsters.readMonsterList(original, 'TameMonsterList');
    const baseline = Buffer.from(g.writeToBuffer());
    assert.deepEqual(parse(g.writeToBuffer()), original);
    if (file.endsWith('MJSaveData2')) { assert.equal(bytes.length - baseline.length, 87); assert.ok(bytes.subarray(0, baseline.length).equals(baseline)); }
    else assert.ok(bytes.equals(baseline));
    let current = learned.resizeLearnedSlots(original, 10).data;
    current = learned.setLearnedAbility(current, 9, 1001).data;
    current = monsters.updateMonsterSlot(current, 'TameMonsterList', 0, { EnemyID: 2455, Count: 999, Used: true }).data;
    current = monsters.updateMonsterSlot(current, 'LegendMonsterList', 0, { EnemyID: 5103, Count: -1, Used: false }).data;
    const expected = structuredClone(original); expected.LearnAbilityList = [...original.LearnAbilityList, -1, -1, -1, -1, 1001];
    expected.TameMonsterList[0] = { EnemyID: 2455, Count: 999, Used: true };
    expected.LegendMonsterList[0] = { EnemyID: 5103, Count: -1, Used: false };
    current = learned.moveLearnedSlot(current, 9, 1).data;
    expected.LearnAbilityList.splice(1, 0, expected.LearnAbilityList.splice(9, 1)[0]);
    current = monsters.moveMonsterSlot(current, 'TameMonsterList', 0, 3).data;
    expected.TameMonsterList.splice(3, 0, expected.TameMonsterList.splice(0, 1)[0]);
    current = monsters.moveMonsterSlot(current, 'LegendMonsterList', 0, 1).data;
    expected.LegendMonsterList.splice(1, 0, expected.LegendMonsterList.splice(0, 1)[0]);
    g.updateJson(current); assert.deepEqual(parse(g.writeToBuffer()), expected);
    assert.deepEqual(current.BackupLearnAbility, original.BackupLearnAbility);
    current = learned.syncToBackup(current, true).data;
    current = learned.setLearnedAbility(current, 0, -1).data;
    current = learned.restoreFromBackup(current, true).data;
    g.updateJson(current); assert.deepEqual(parse(g.writeToBuffer()), current);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash);
  });
}
