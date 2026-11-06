import test, { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer, type ViteDevServer } from 'vite';
type DetailsModule = typeof import('../../src/lib/templates/octopath-traveler-ii/saveEditor/utils/item-details');
let allItems: DetailsModule['allItems'];
let getItemDetails: DetailsModule['getItemDetails'];
let matchesItem: DetailsModule['matchesItem'];
let itemCatalogue: DetailsModule['itemCatalogue'];

const root = process.cwd();
const sources = {
  steam: path.join(root, 'tests/saves/octopath-traveler-ii/steam/SaveData0.sav'),
  switch: path.join(root, '.local/test-saves/MJSaveData2'),
};
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, sha(file)]));
let vite: ViteDevServer;
let Gvas: any;
test.beforeAll(async () => {
  vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-details-qa/ssr-cache' });
  await vite.ssrLoadModule('/src/lib/utils/prototype.ts');
  Gvas = (await vite.ssrLoadModule('/src/lib/utils/gvas/index.ts')).default;
  ({ allItems, getItemDetails, matchesItem, itemCatalogue } = await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/utils/item-details.ts'));
});
test.afterAll(async () => {
  await vite?.close();
  for (const [key, file] of Object.entries(sources)) expect(sha(file)).toBe(before[key]);
});
const decode = (file: string) => {
  const bytes = fs.readFileSync(file);
  return new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).parseToJson();
};
async function load(page: Page, info: TestInfo, platform: keyof typeof sources) {
  const copy = info.outputPath(platform === 'steam' ? 'SaveData0.sav' : 'MJSaveData2');
  fs.copyFileSync(sources[platform], copy, fs.constants.COPYFILE_EXCL);
  await page.goto('/octopath-traveler-ii/save-editor', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').setInputFiles(copy);
  await expect(page.locator('.gtc-tool-save')).toBeVisible();
  return decode(copy);
}
const tab = (page: Page, name: string) => page.locator('.gtc-tab').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
const quantity = (page: Page, id: number) => page.locator(`[data-item-id="${id}"] input`);
async function exported(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download');
  await page.locator('.gtc-tool-save').click();
  const download = await pending, file = info.outputPath(name);
  await download.saveAs(file);
  return { file, json: decode(file) };
}
function initialized(original: any) {
  const expected = structuredClone(original);
  if (expected.PlayerParty.SubMemberID === undefined) expected.PlayerParty.SubMemberID = [-1, -1, -1, -1, -1, -1, -1, -1];
  return expected;
}
function count(expected: any, id: number, value: number) {
  const items = expected.PlayerBackpack.ItemList, index = items.findIndex((i: any) => i.ItemId === id);
  if (index !== -1 && value === 0) { items.splice(index, 1); items.push({ ItemId: 0, Num: 0 }); }
  else if (index !== -1) items[index].Num = value;
  else { const empty = items.findIndex((i: any) => i.ItemId === 0); expect(empty).toBeGreaterThanOrEqual(0); items[empty] = { ItemId: id, Num: value }; }
}

test('956 runtime records preserve accepted names, categories, descriptions, all stat values and ordered raw arrays', () => {
  const accepted = JSON.parse(fs.readFileSync('.local/ot2-stage-a/session-001/accepted-a/selected-audit.json', 'utf8'));
  expect(allItems).toHaveLength(956);
  expect(new Set(allItems.map(i => i.id)).size).toBe(956);
  for (const original of accepted) {
    const item = getItemDetails(original.id)!;
    for (const key of ['rowName', 'zhCN', 'en', 'editorCategory', 'gameCategory', 'nameRef', 'descriptionRef', 'description']) expect(item[key as keyof typeof item], `${original.id}.${key}`).toEqual(original[key]);
    expect(item.stats).toEqual(original.gameCategory.endsWith('::eEQUIPMENT') ? original.raw.EquipmentRevision : null);
    expect(item.effects).toEqual(original.raw.Ailment);
    expect(item.attributeResist).toEqual(original.raw.AttributeResist);
    expect(item.diseaseResist).toEqual(original.raw.DiseaseResist);
  }
  expect(allItems.filter(i => i.stats)).toHaveLength(526);
  expect(allItems.filter(i => i.description)).toHaveLength(606);
  expect(getItemDetails(11159)?.editorCategory).toBe(12);
  expect(getItemDetails(11159)?.stats?.ACC).toBe(15);
  expect(getItemDetails(2271)?.zhCN).toBe('帽盔');
  expect(itemCatalogue.source.unknownParsedTypes).toBe('not-separately-counted');
  expect(itemCatalogue.source.independentToolVerified).toBe(false);
  expect(getItemDetails(2147483646)).toBeUndefined();
});

test('query supports Chinese, case-insensitive English, descriptions, effects, category and signed stats', () => {
  expect(matchesItem(getItemDetails(2069)!, '历战之剑')).toBe(true);
  expect(matchesItem(getItemDetails(2069)!, 'BATTLE-TESTED blade')).toBe(true);
  expect(matchesItem(getItemDetails(1904)!, '恢复 我方 单体')).toBe(true);
  expect(matchesItem(getItemDetails(2069)!, '武器威力增益')).toBe(true);
  expect(matchesItem(getItemDetails(11159)!, '', 12, 'ACC')).toBe(true);
  expect(matchesItem(getItemDetails(11159)!, '饰品')).toBe(true);
  expect(allItems.filter(i => i.stats).every(i => matchesItem(i, '装备'))).toBe(true);
  expect(matchesItem(getItemDetails(2069)!, '', 0)).toBe(false);
  const negative = allItems.find(i => i.stats && i.stats.ATK < 0)!;
  expect(matchesItem(negative, '', -1, 'ATK')).toBe(true);
});

for (const platform of ['switch', 'steam'] as const) {
  test(`${platform}: details, search, filtering and candidate previews do not change decoded save`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const original = await load(page, info, platform);
    const expected = initialized(original);
    if (platform === 'steam' && original.PlayerParty.SubMemberID === undefined) info.annotations.push({ type: 'known-baseline-difference', description: 'Only the existing initialization of eight -1 SubMemberID entries is allowed; every other decoded field is compared exactly.' });
    await tab(page, '背包').click();
    await expect(page.locator('[data-item-id="1904"] .stat-badge')).toContainText('HP +500');
    await page.getByLabel('搜索物品', { exact: true }).fill('battle-tested blade');
    await expect(page.locator('[data-item-id]')).toHaveCount(1);
    const detail = page.locator('[data-item-id="2069"]');
    await expect(detail).toContainText('+400'); await expect(detail).toContainText('+120');
    await expect(detail.locator('.equipment-stat')).toHaveCount(2);
    await expect(detail).toContainText('物理技能威力 +30%');
    await expect(detail).not.toContainText('130%');
    await page.getByLabel('搜索物品', { exact: true }).fill('增强HP的坚果');
    await expect(page.locator('[data-item-id="1950"] .stat-badge')).toHaveText('最大HP +75');
    await page.getByLabel('搜索物品', { exact: true }).fill('增强物攻的坚果');
    await expect(page.locator('[data-item-id="1956"] .stat-badge')).toHaveText('物攻 +7');
    await page.getByLabel('搜索物品', { exact: true }).fill('帽盔');
    await expect(page.locator('[data-item-id="2271"] .official')).toHaveCount(0);
    await page.getByLabel('搜索物品', { exact: true }).fill('wallet');
    await expect(page.locator('[data-item-id="10498"] .official')).toHaveCount(0);
    await page.getByLabel('搜索物品', { exact: true }).fill('葡萄叶');
    await expect(page.locator('[data-item-id="10569"]')).toContainText('调合 · HP +450');
    await expect(page.locator('[data-item-id="10569"]')).toContainText('增强 · HP +2000');
    await page.getByLabel('搜索物品', { exact: true }).fill('章鱼烧');
    await expect(page.locator('[data-item-id="11080"]')).toContainText('随机效果');
    await expect(page.locator('[data-item-id="11080"]')).toContainText('HP +888');
    await page.getByLabel('搜索物品', { exact: true }).fill('新月项链');
    await expect(page.locator('[data-item-id="11159"] .category')).toContainText('贵重物品');
    await expect(page.locator('[data-item-id="11159"] .stat-badges')).toContainText('+15');
    await page.getByLabel('搜索物品', { exact: true }).fill('卫兵队的仪式帽');
    await expect(page.locator('[data-item-id="2287"]')).toContainText('防止沉默效果');
    await page.getByLabel('搜索物品', { exact: true }).fill('武器威力增益');
    await expect(page.locator('[data-item-id="2069"]')).toBeVisible();
    await page.getByRole('button', { name: '清除搜索与筛选' }).click();
    await page.getByRole('button', { name: '全部分类', exact: true }).click();
    await page.getByLabel('装备属性筛选').selectOption('ATK');
    const countWithAttack = allItems.filter(i => i.stats && i.stats.ATK !== 0).length;
    await expect(page.locator('[data-item-id]')).toHaveCount(countWithAttack);
    const negative = allItems.find(i => i.stats && i.stats.ATK < 0)!;
    await expect(page.locator(`[data-item-id="${negative.id}"] .negative`).first()).toBeVisible();
    await page.getByLabel('有效果或抗性记录').check();
    await expect(page.locator('[data-item-id]')).toHaveCount(allItems.filter(i => matchesItem(i, '', -1, 'ATK', true)).length);
    await page.getByRole('button', { name: '清除搜索与筛选' }).click();
    await page.screenshot({ path: info.outputPath('inventory-details.png'), fullPage: false });
    await tab(page, '角色').click(); await tab(page, '装备').click();
    const field = page.locator('.ot2-equipment-field').first();
    await field.getByRole('button', { name: '查看当前装备详情' }).click();
    await expect(field.locator('[data-item-detail]')).toBeVisible();
    const input = field.locator('.gtc-autocomplete-input input');
    await input.click(); await input.fill('Battle-Tested Blade');
    await field.locator('.gtc-option-details').click();
    await expect(field.locator('[data-item-detail="2069"]')).toContainText('+400');
    await page.screenshot({ path: info.outputPath('equipment-details.png'), fullPage: false });
    const result = await exported(page, info, 'no-edit-export');
    expect(result.json).toEqual(expected);
    expect(errors).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test(`${platform}: pending quantities survive unrelated updates, programmatic filtering, category/tab changes and export/reload`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const original = await load(page, info, platform), expected = initialized(original);
    await tab(page, '背包').click();
    // No blur/change for 1904: protect the draft against another field's store update.
    await quantity(page, 1904).focus();
    await quantity(page, 1904).evaluate((input: HTMLInputElement) => { input.value = '17'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await quantity(page, 1907).evaluate((input: HTMLInputElement) => { input.value = '18'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect(quantity(page, 1904)).toHaveValue('17');
    // Remove the still-focused field without blur: its opt-in unmount handler must commit once.
    await page.getByLabel('搜索物品', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = '历战之剑'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('[data-item-id="1904"]')).toHaveCount(0);
    await page.getByRole('button', { name: '清除搜索与筛选' }).click();
    await expect(quantity(page, 1904)).toHaveValue('17'); await expect(quantity(page, 1907)).toHaveValue('18');
    count(expected, 1904, 17); count(expected, 1907, 18);
    await quantity(page, 1904).fill('19');
    await page.locator('[data-item-id="1907"] .official').click();
    await expect(quantity(page, 1904)).toHaveValue('19'); count(expected, 1904, 19);
    await quantity(page, 1904).fill('20'); await page.getByRole('button', { name: '剑', exact: true }).click();
    await page.getByRole('button', { name: '道具', exact: true }).click();
    await expect(quantity(page, 1904)).toHaveValue('20'); count(expected, 1904, 20);
    await quantity(page, 1904).fill('21'); await tab(page, '角色').click(); await tab(page, '背包').click();
    await expect(quantity(page, 1904)).toHaveValue('21'); count(expected, 1904, 21);
    const result = await exported(page, info, 'quantity-export'); expect(result.json).toEqual(expected);
    page.once('dialog', dialog => dialog.accept()); await page.locator('.gtc-tool-eject').click();
    await page.locator('input[type=file]').setInputFiles(result.file); await tab(page, '背包').click();
    await expect(quantity(page, 1904)).toHaveValue('21');
    expect(errors).toEqual([]);
  });
}

test('equipment choice still updates exactly the original equipment field', async ({ page }, info) => {
  const original = await load(page, info, 'switch'), expected = initialized(original);
  await tab(page, '角色').click(); await tab(page, '装备').click();
  const field = page.locator('.ot2-equipment-field').first();
  const input = field.locator('.gtc-autocomplete-input input');
  await input.click(); await input.fill('Battle-Tested Blade');
  await field.locator('.gtc-option-name').filter({ hasText: '历战之剑' }).click();
  await expect(field.locator('.gtc-autocomplete-dropdown')).toBeHidden();
  expected.PlayerMember[0].Equipment.Sword = 2069;
  await field.getByRole('button', { name: '查看当前装备详情' }).click();
  await expect(field.locator('[data-item-detail="2069"]')).toBeVisible();
  expect((await exported(page, info, 'equipped-export')).json).toEqual(expected);
});

test('eject discards an uncommitted draft and does not apply it to the next save', async ({ page }, info) => {
  await load(page, info, 'switch'); await tab(page, '背包').click();
  await quantity(page, 1904).fill('77');
  // Invoke eject without a pointer-induced blur/change.
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.gtc-tool-eject').evaluate((button: HTMLButtonElement) => button.click());
  const copy = info.outputPath('second-MJSaveData2'); fs.copyFileSync(sources.switch, copy);
  await page.locator('input[type=file]').setInputFiles(copy); await expect(page.locator('.gtc-tool-save')).toBeVisible();
  expect((await exported(page, info, 'after-eject')).json).toEqual(initialized(decode(copy)));
});

test('0/1/99 UI operations preserve a synthetic unknown ID and every non-target save field', async ({ page }, info) => {
  const bytes = fs.readFileSync(sources.switch);
  const gvas = new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const original = gvas.parseToJson();
  const empty = original.PlayerBackpack.ItemList.findIndex((item: any) => item.ItemId === 0);
  expect(empty).toBeGreaterThanOrEqual(0);
  original.PlayerBackpack.ItemList[empty] = { ItemId: 2147483646, Num: 7 };
  gvas.updateJson(original);
  const copy = info.outputPath('MJSaveData2'); fs.writeFileSync(copy, Buffer.from(gvas.writeToBuffer()), { flag: 'wx' });
  await page.goto('/octopath-traveler-ii/save-editor', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').setInputFiles(copy); await expect(page.locator('.gtc-tool-save')).toBeVisible();
  await tab(page, '背包').click();
  const expected = initialized(original);
  for (const value of [0, 1, 99]) {
    await quantity(page, 1904).fill(String(value)); await quantity(page, 1904).press('Tab');
    count(expected, 1904, value);
    const result = await exported(page, info, `unknown-${value}`);
    expect(result.json).toEqual(expected);
    expect(result.json.PlayerBackpack.ItemList.find((item: any) => item.ItemId === 2147483646)).toEqual({ ItemId: 2147483646, Num: 7 });
  }
});

test('all 956 items use compact cards, every category is retained, and equipment shares badges', async ({ page }, info) => {
  const original = await load(page, info, 'switch');
  await tab(page, '背包').click();
  await expect(page.getByRole('button', { name: '测试物品', exact: true })).toHaveCount(0);
  await expect(page.locator('.detail-button')).toHaveCount(0);
  await page.getByRole('button', { name: '全部分类', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(956);
  const ids = await page.locator('.item-card').evaluateAll(cards => cards.map(card => Number(card.getAttribute('data-item-id'))));
  expect(ids).toEqual(allItems.map(item => item.id));
  expect(await page.locator('.item-card input').evaluateAll(inputs => inputs.every(input => input.getBoundingClientRect().width === 60))).toBe(true);
  await expect(page.locator('[data-item-id="1904"] .stat-badge')).toHaveText('HP +500');
  await expect(page.locator('[data-item-id="1914"] .stat-badge')).toHaveText('HP/SP/BP 100%');
  await expect(page.locator('[data-item-id="1928"]')).not.toContainText('40%');
  await expect(page.locator('[data-item-id="2048"] .negative')).toHaveText('命中 -55');
  await expect(page.locator('[data-item-id="1983"] .stat-badge')).toHaveCount(0);
  const expectedDescriptions = allItems.filter(item => item.description).map(item => item.description);
  expect(await page.locator('.item-card .official').allTextContents()).toEqual(expectedDescriptions);
  await expect(page.locator('.rows')).not.toContainText(/参数|本版本原始说明为空|尚未验证|非最终战斗伤害/);
  const inventoryBadges = await page.locator('[data-item-id="2069"] .stat-badge').allTextContents();
  const names = ['道具', '剑', '长枪', '短剑', '斧头', '弓', '杖', '护盾', '防具 头部', '防具 身体', '饰品', '调合素材', '贵重物品', '情报'];
  for (const [index, name] of names.entries()) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.item-card')).toHaveCount(allItems.filter(item => item.editorCategory === index).length);
  }
  await page.getByRole('button', { name: '贵重物品', exact: true }).click();
  await expect(page.locator('[data-item-id="11159"] .official')).toHaveCount(0);
  await page.getByLabel('搜索物品', { exact: true }).fill('恢复');
  await page.screenshot({ path: info.outputPath('cards-rollout.png'), fullPage: false });
  await tab(page, '角色').click(); await tab(page, '装备').click();
  const field = page.locator('.ot2-equipment-field').first();
  await field.getByRole('button', { name: '查看当前装备详情' }).click();
  await field.locator('.gtc-autocomplete-input input').click();
  await field.locator('.gtc-autocomplete-input input').fill('Battle-Tested Blade');
  await field.locator('.gtc-option-details').click();
  expect(await field.locator('[data-item-detail="2069"] .stat-badge').allTextContents()).toEqual(inventoryBadges);
  expect((await exported(page, info, 'rollout-noedit')).json).toEqual(initialized(original));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
