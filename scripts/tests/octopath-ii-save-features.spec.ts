import test, { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer, type ViteDevServer } from 'vite';

const sources = { switch: '.local/test-saves/MJSaveData2', steam: 'tests/saves/octopath-traveler-ii/steam/SaveData0.sav' };
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before = Object.fromEntries(Object.entries(sources).map(([k, p]) => [k, sha(p)]));
let vite: ViteDevServer, Gvas: any, pageErrors: string[];
test.beforeAll(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-save-features-qa/browser-ssr' });
  await vite.ssrLoadModule('/src/lib/utils/prototype.ts');
  Gvas = (await vite.ssrLoadModule('/src/lib/utils/gvas/index.ts')).default;
});
test.afterAll(async () => { await vite?.close(); for (const [k, p] of Object.entries(sources)) expect(sha(p)).toBe(before[k]); });
test.beforeEach(({ page }) => { pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message)); });
test.afterEach(() => expect(pageErrors).toEqual([]));
function decode(bytes: Buffer) {
  return new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).parseToJson();
}
function initialized(original: any) {
  const value = structuredClone(original);
  if (value.PlayerParty.SubMemberID === undefined) value.PlayerParty.SubMemberID = Array(8).fill(-1);
  return value;
}
async function load(page: Page, info: TestInfo, platform: keyof typeof sources, modify?: (json: any) => void) {
  const bytes = fs.readFileSync(sources[platform]), g = new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const original = g.parseToJson(), copy = info.outputPath(platform === 'switch' ? 'MJSaveData2' : 'SaveData0.sav');
  if (modify) { modify(original); g.updateJson(original); fs.writeFileSync(copy, Buffer.from(g.writeToBuffer()), { flag: 'wx' }); }
  else fs.copyFileSync(sources[platform], copy, fs.constants.COPYFILE_EXCL);
  await page.goto('/octopath-traveler-ii/save-editor', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').setInputFiles(copy);
  await expect(page.locator('.gtc-tool-save')).toBeVisible();
  return initialized(original);
}
const tab = (page: Page, name: string) => page.locator('.gtc-tab').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
async function hikari(page: Page) { await tab(page, '角色').click(); await tab(page, '光（Hikari）').first().click(); await tab(page, '习得技能').click(); }
async function ochette(page: Page) { await tab(page, '角色').click(); await tab(page, '欧修缇（Ochette）').click(); await tab(page, '捕获魔物').click(); }
const learnedRoot = (page: Page) => page.locator('[data-save-feature="learned"]');
const monsterRoot = (page: Page) => page.locator('[data-save-feature="monsters"]');
async function exported(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('.gtc-tool-save').click();
  const file = info.outputPath(name); await (await pending).saveAs(file);
  return { file, bytes: fs.readFileSync(file), json: decode(fs.readFileSync(file)) };
}
async function dirty(page: Page) {
  return page.evaluate(async () => {
    const url = '/src/lib/stores/index.ts'; const stores = await import(url);
    let value = false; const stop = stores.isDirty.subscribe((v: boolean) => value = v); stop(); return value;
  });
}

for (const platform of ['switch', 'steam'] as const) {
  test(`${platform}: browsing both features, searches and advanced panels leaves the save and backup unchanged`, async ({ page }, info) => {
    const expected = await load(page, info, platform);
    await hikari(page);
    await expect(learnedRoot(page).locator('.slot')).toHaveCount(5);
    await page.getByLabel('技能 1搜索', { exact: true }).fill('八字斩');
    await page.getByText('剧情备份管理（高级）', { exact: true }).click();
    expect(await dirty(page)).toBe(false);
    await ochette(page);
    await expect(monsterRoot(page).locator('.slot')).toHaveCount(10);
    await page.getByLabel('魔物 1搜索', { exact: true }).fill('2001');
    await monsterRoot(page).locator('summary').first().click();
    await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
    await expect(monsterRoot(page).locator('.slot')).toHaveCount(10);
    expect(await dirty(page)).toBe(false);
    const out = await exported(page, info, 'no-edit.edited');
    expect(out.json).toEqual(expected);
    const original = fs.readFileSync(sources[platform]);
    if (platform === 'switch') { expect(original.length - out.bytes.length).toBe(87); expect(original.subarray(0, out.bytes.length).equals(out.bytes)).toBe(true); }
    else expect(expected.PlayerParty.SubMemberID).toEqual(Array(8).fill(-1));
  });
}

test('learned skills search, expansion, cancelled/confirmed deletion and backup actions export exactly the intended fields', async ({ page }, info) => {
  const expected = await load(page, info, 'switch');
  await hikari(page);
  await page.getByLabel('技能 1搜索', { exact: true }).fill('1001');
  await page.getByLabel('技能 1', { exact: true }).selectOption('1001'); expected.LearnAbilityList[0] = 1001;
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '添加槽位（实验性）', exact: true }).click();
  expected.LearnAbilityList.push(-1, -1, -1, -1, -1);
  await page.getByLabel('技能 10搜索', { exact: true }).fill('极·新月横扫');
  await page.getByLabel('技能 10', { exact: true }).selectOption('1181'); expected.LearnAbilityList[9] = 1181;
  await expect(learnedRoot(page)).toContainText('当前 10 槽 · 实验性');
  expect(await dirty(page)).toBe(true);
  await page.screenshot({ path: info.outputPath('learned-expanded.png'), fullPage: false });
  expect((await exported(page, info, 'expanded.edited')).json).toEqual(expected);
  page.once('dialog', d => d.dismiss());
  await learnedRoot(page).locator('.slot').nth(9).getByRole('button', { name: '删除槽位', exact: true }).click();
  await expect(learnedRoot(page).locator('.slot')).toHaveCount(10); expect(await dirty(page)).toBe(false);
  page.once('dialog', async d => { expect(d.message()).toContain('1181'); await d.accept(); });
  await learnedRoot(page).locator('.slot').nth(9).getByRole('button', { name: '删除槽位', exact: true }).click();
  expected.LearnAbilityList.splice(9, 1);
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '恢复默认 5 槽', exact: true }).click();
  await expect(learnedRoot(page).locator('.slot')).toHaveCount(9);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '恢复默认 5 槽', exact: true }).click();
  expected.LearnAbilityList.length = 5;
  expect((await exported(page, info, 'shrunk.edited')).json).toEqual(expected);
  await page.getByText('剧情备份管理（高级）', { exact: true }).click();
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '同步当前技能到剧情备份', exact: true }).click();
  expect(await dirty(page)).toBe(false);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '同步当前技能到剧情备份', exact: true }).click();
  expected.BackupLearnAbility.Org_LearnAbility = [...expected.LearnAbilityList];
  await learnedRoot(page).locator('.slot').first().getByRole('button', { name: '清空槽位', exact: true }).click();
  expected.LearnAbilityList[0] = -1;
  expect((await exported(page, info, 'synced-and-cleared.edited')).json).toEqual(expected);
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: '从备份恢复', exact: true }).click();
  expect(await dirty(page)).toBe(false);
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: '从备份恢复', exact: true }).click();
  expected.LearnAbilityList = [...expected.BackupLearnAbility.Org_LearnAbility];
  const out = await exported(page, info, 'restored.edited'); expect(out.json).toEqual(expected);
  await page.locator('.gtc-tool-eject').click(); await page.locator('input[type=file]').setInputFiles(out.file); await hikari(page);
  await expect(page.getByLabel('技能 1', { exact: true })).toHaveValue('1001');
});

test('monster categories, countMax, Used, invalid counts and exact clear survive export and reload', async ({ page }, info) => {
  const expected = await load(page, info, 'switch'); await ochette(page);
  const first = monsterRoot(page).locator('.slot').first();
  await expect(page.getByLabel('魔物 1', { exact: true }).locator('option[value="5103"]')).toHaveCount(0);
  await page.getByLabel('魔物 1搜索', { exact: true }).fill('玛西娜');
  await page.getByLabel('魔物 1', { exact: true }).selectOption('2001'); expected.TameMonsterList[0].EnemyID = 2001;
  await page.getByLabel('魔物 1 召唤次数', { exact: true }).fill('999'); expected.TameMonsterList[0].Count = 999;
  await first.locator('summary').click(); await page.getByLabel('魔物 1 Used', { exact: true }).check(); expected.TameMonsterList[0].Used = true;
  await first.getByRole('button', { name: '填入字典 countMax', exact: true }).click(); expected.TameMonsterList[0].Count = 7;
  expect((await exported(page, info, 'monster-count.edited')).json).toEqual(expected);
  await page.getByLabel('魔物 1 召唤次数', { exact: true }).fill('1.5');
  await expect(monsterRoot(page).getByRole('alert')).toContainText('整数');
  expect(await dirty(page)).toBe(false);
  expect((await exported(page, info, 'invalid-count.edited')).json).toEqual(expected);
  await first.getByRole('button', { name: '清空', exact: true }).click();
  expected.TameMonsterList[0] = { EnemyID: -1, Count: 0, Used: false };
  await expect(page.getByLabel('魔物 1 Used', { exact: true })).not.toBeChecked();
  await page.screenshot({ path: info.outputPath('normal-monsters.png'), fullPage: false });
  await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
  await expect(page.getByLabel('魔物 1', { exact: true }).locator('option[value="2455"]')).toHaveCount(0);
  await page.getByLabel('魔物 1', { exact: true }).selectOption('5103'); expected.LegendMonsterList[0].EnemyID = 5103;
  await page.getByLabel('魔物 1 召唤次数', { exact: true }).fill('-1'); expected.LegendMonsterList[0].Count = -1;
  await monsterRoot(page).locator('.slot').first().locator('summary').click();
  await page.getByLabel('魔物 1 Used', { exact: true }).check(); expected.LegendMonsterList[0].Used = true;
  await page.screenshot({ path: info.outputPath('legend-monsters.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const out = await exported(page, info, 'monsters.edited'); expect(out.json).toEqual(expected);
  await page.locator('.gtc-tool-eject').click(); await page.locator('input[type=file]').setInputFiles(out.file); await ochette(page);
  await expect(page.getByLabel('魔物 1', { exact: true })).toHaveValue('-1');
  await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
  await expect(page.getByLabel('魔物 1 召唤次数', { exact: true })).toHaveValue('-1');
});

test('unknown IDs remain visible and untouched through search, unrelated edits and export', async ({ page }, info) => {
  const expected = await load(page, info, 'switch', j => {
    j.LearnAbilityList[0] = 2147483646;
    j.BackupLearnAbility.Org_LearnAbility[0] = 2147483645;
    j.TameMonsterList[0] = { EnemyID: 2147483644, Count: -1, Used: true };
    j.LegendMonsterList[0].EnemyID = 2147483643;
  });
  await hikari(page);
  await expect(page.getByLabel('技能 1', { exact: true }).locator('option:checked')).toContainText('未知 (ID: 2147483646)');
  await page.getByLabel('技能 1搜索', { exact: true }).fill('1001');
  await expect(page.getByLabel('技能 1', { exact: true })).toHaveValue('2147483646');
  await page.getByRole('button', { name: '添加槽位（实验性）', exact: true }).click(); expected.LearnAbilityList.push(-1);
  await ochette(page);
  await expect(page.getByLabel('魔物 1', { exact: true }).locator('option:checked')).toContainText('未知 (ID: 2147483644)');
  await page.getByLabel('魔物 1搜索', { exact: true }).fill('刺河豚');
  await expect(page.getByLabel('魔物 1', { exact: true })).toHaveValue('2147483644');
  await page.getByLabel('魔物 1 召唤次数', { exact: true }).fill('999'); expected.TameMonsterList[0].Count = 999;
  expect((await exported(page, info, 'unknowns.edited')).json).toEqual(expected);
});

test('malformed or missing fields are shown as unavailable without implicit initialization or truncation', async ({ page }, info) => {
  const expected = await load(page, info, 'switch', j => { delete j.LearnAbilityList; delete j.BackupLearnAbility; j.TameMonsterList.pop(); });
  await hikari(page); await expect(learnedRoot(page).getByRole('status')).toContainText('已保留原始数据');
  await ochette(page); await expect(monsterRoot(page).getByRole('status')).toContainText('已保留原始数据');
  expect(await dirty(page)).toBe(false);
  expect((await exported(page, info, 'unsupported.edited')).json).toEqual(expected);
});
