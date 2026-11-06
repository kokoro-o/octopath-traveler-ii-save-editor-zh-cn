import test, { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer, type ViteDevServer } from 'vite';

const source = '.local/test-saves/MJSaveData2';
const sha = () => createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const sourceHash = sha();
let vite: ViteDevServer, Gvas: any, errors: string[];
test.beforeAll(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-save-layout-qa/ssr-cache' });
  await vite.ssrLoadModule('/src/lib/utils/prototype.ts');
  Gvas = (await vite.ssrLoadModule('/src/lib/utils/gvas/index.ts')).default;
});
test.afterAll(async () => { await vite?.close(); expect(sha()).toBe(sourceHash); });
test.beforeEach(({ page }) => { errors = []; page.on('pageerror', e => errors.push(e.message)); });
test.afterEach(() => expect(errors).toEqual([]));
const decode = (bytes: Buffer) => new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).parseToJson();
async function load(page: Page, info: TestInfo, modify?: (json: any) => void) {
  const bytes = fs.readFileSync(source), g = new Gvas(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)), json = g.parseToJson();
  const copy = info.outputPath('MJSaveData2');
  if (modify) { modify(json); g.updateJson(json); fs.writeFileSync(copy, Buffer.from(g.writeToBuffer()), { flag: 'wx' }); }
  else fs.copyFileSync(source, copy, fs.constants.COPYFILE_EXCL);
  await page.goto('/octopath-traveler-ii/save-editor', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').setInputFiles(copy);
  await expect(page.locator('.gtc-tool-save')).toBeVisible();
  return structuredClone(json);
}
const tab = (page: Page, name: string) => page.locator('.gtc-tab').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
async function hikari(page: Page) { await tab(page, '角色').click(); await tab(page, '光（Hikari）').first().click(); await tab(page, '习得技能').click(); }
async function ochette(page: Page) { await tab(page, '角色').click(); await tab(page, '欧修缇（Ochette）').click(); await tab(page, '捕获魔物').click(); }
const skills = (page: Page) => page.locator('[data-save-feature="learned"]');
const monsters = (page: Page) => page.locator('[data-save-feature="monsters"]');
const move = (array: any[], from: number, to: number) => array.splice(to, 0, array.splice(from, 1)[0]);
async function exported(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('.gtc-tool-save').click();
  const file = info.outputPath(name); await (await pending).saveAs(file);
  return { json: decode(fs.readFileSync(file)), file };
}
async function dirty(page: Page) {
  return page.evaluate(async () => {
    const url = '/src/lib/stores/index.ts', m = await import(url); let value = false;
    const stop = m.isDirty.subscribe((v: boolean) => value = v); stop(); return value;
  });
}

test('wide rows show complete descriptions, truthful costs, monster ranks and processing products', async ({ page }, info) => {
  const expected = await load(page, info); await hikari(page);
  const first = skills(page).locator('.slot').first();
  await expect(first.locator('.cost')).toHaveText('SP 45');
  await expect(first.locator('.description')).toHaveText('用长枪对敌方全体造成特大量伤害。');
  const boxes = await skills(page).locator('.slot').evaluateAll(rows => rows.slice(0, 2).map(r => ({ x: r.getBoundingClientRect().x, y: r.getBoundingClientRect().y })));
  expect(boxes[0].x).toBe(boxes[1].x); expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  await page.getByLabel('技能 1', { exact: true }).selectOption('1115');
  await expect(first.locator('.description')).toHaveText('用短剑对随机目标\n造成3～5次伤害。');
  expect(await first.locator('.description').evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  await page.getByLabel('技能 1', { exact: true }).selectOption('1209'); await expect(first.locator('.cost')).toHaveText('叶币 500');
  await page.getByLabel('技能 1', { exact: true }).selectOption('1223'); await expect(first.locator('.cost')).toHaveText('SP 100%'); expected.LearnAbilityList[0] = 1223;
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('learned-rows.png'), fullPage: false });
  await ochette(page);
  const monster = monsters(page).locator('.slot').first();
  await expect(monster.getByLabel('强度 6 星', { exact: true })).toBeVisible();
  await expect(monster.locator('.skill-name')).toHaveText('毒针乱射');
  await expect(monster.locator('.description')).toContainText('弓 / 敌方全体物理攻击');
  await expect(monster.locator('.meat')).toHaveText('加工产物：白柠檬牛油');
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: info.outputPath('monster-rows.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
  await expect(monsters(page).locator('.slot').first().locator('.meat')).toHaveCount(0);
  expect((await exported(page, info, 'metadata.edited')).json).toEqual(expected);
});

test('arrows and native handle drag reorder skills with unknown IDs and leave the entire backup unchanged', async ({ page }, info) => {
  const expected = await load(page, info, j => j.LearnAbilityList[0] = 2147483646); await hikari(page);
  await expect(skills(page).locator('.slot').first().locator('[data-slot-details]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上移技能槽位 1', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下移技能槽位 5', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '下移技能槽位 1', exact: true }).click(); move(expected.LearnAbilityList, 0, 1);
  await expect(page.getByLabel('技能 2', { exact: true })).toHaveValue('2147483646');
  await page.getByRole('button', { name: '上移技能槽位 2', exact: true }).click(); move(expected.LearnAbilityList, 1, 0);
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: '拖拽技能槽位 1', exact: true }).dragTo(skills(page).locator('.slot').nth(2), { targetPosition: { x: 10, y: 10 } });
    move(expected.LearnAbilityList, 0, 2);
  } else {
    await page.getByRole('button', { name: '下移技能槽位 1', exact: true }).click(); move(expected.LearnAbilityList, 0, 1);
    await page.getByRole('button', { name: '下移技能槽位 2', exact: true }).click(); move(expected.LearnAbilityList, 1, 2);
  }
  await expect(page.getByLabel('技能 3', { exact: true })).toHaveValue('2147483646');
  await expect(skills(page).locator('.slot').nth(2).locator('[data-slot-details]')).toHaveCount(0);
  expect(await dirty(page)).toBe(true);
  const out = await exported(page, info, 'skills-reordered.edited'); expect(out.json).toEqual(expected);
  await page.locator('.gtc-tool-eject').click(); await page.locator('input[type=file]').setInputFiles(out.file); await hikari(page);
  await expect(page.getByLabel('技能 3', { exact: true })).toHaveValue('2147483646');
});

test('monster reordering moves Count and Used with the record, preserves ten slots, and stays within each list', async ({ page }, info) => {
  const expected = await load(page, info, j => { j.TameMonsterList[0] = { EnemyID: 2147483646, Count: -1, Used: true }; j.TameMonsterList[1].Count = 999; j.LegendMonsterList[1].Used = true; });
  await ochette(page);
  await expect(monsters(page).locator('.slot').first().locator('[data-slot-details]')).toHaveCount(0);
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: '拖拽魔物槽位 1', exact: true }).dragTo(monsters(page).locator('.slot').nth(2), { targetPosition: { x: 10, y: 10 } });
    move(expected.TameMonsterList, 0, 2);
  } else {
    await page.getByRole('button', { name: '下移魔物槽位 1', exact: true }).click(); move(expected.TameMonsterList, 0, 1);
    await page.getByRole('button', { name: '下移魔物槽位 2', exact: true }).click(); move(expected.TameMonsterList, 1, 2);
  }
  await expect(page.getByLabel('魔物 3', { exact: true })).toHaveValue('2147483646');
  await expect(page.getByLabel('魔物 3 召唤次数', { exact: true })).toHaveValue('-1');
  await monsters(page).locator('.slot').nth(2).locator('summary').click();
  await expect(page.getByLabel('魔物 3 Used', { exact: true })).toBeChecked();
  await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
  await page.getByRole('button', { name: '上移魔物槽位 2', exact: true }).click(); move(expected.LegendMonsterList, 1, 0);
  await expect(page.getByLabel('魔物 1 召唤次数', { exact: true })).toHaveValue('99');
  await expect(monsters(page).locator('.slot')).toHaveCount(10);
  expect((await exported(page, info, 'monsters-reordered.edited')).json).toEqual(expected);
});

test('cancelled, foreign and cross-list drag sessions do not mark dirty or change a save', async ({ page }, info) => {
  const expected = await load(page, info); await ochette(page);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  const first = monsters(page).locator('.slot').first();
  await first.getByRole('button', { name: '拖拽魔物槽位 1', exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer });
  await first.dispatchEvent('dragend', { dataTransfer: transfer });
  await monsters(page).locator('.slot').nth(1).dispatchEvent('drop', { dataTransfer: transfer });
  expect(await dirty(page)).toBe(false);
  await first.getByRole('button', { name: '拖拽魔物槽位 1', exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.getByRole('tab', { name: '传说魔物 (10 槽)', exact: true }).click();
  await monsters(page).locator('.slot').nth(1).dispatchEvent('drop', { dataTransfer: transfer });
  expect(await dirty(page)).toBe(false);
  expect((await exported(page, info, 'rejected-drag.edited')).json).toEqual(expected);
  await transfer.dispose();
});
