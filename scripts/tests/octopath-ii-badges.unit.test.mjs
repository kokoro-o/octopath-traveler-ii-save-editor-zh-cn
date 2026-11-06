import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, itemEffectBadges, allItems, getItemDetails;
before(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', cacheDir: '.local/ot2-details-qa/unit-cache' });
  ({ itemEffectBadges } = await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/utils/item-badges.ts'));
  ({ allItems, getItemDetails } = await vite.ssrLoadModule('/src/lib/templates/octopath-traveler-ii/saveEditor/utils/item-details.ts'));
});
after(async () => { await vite?.close(); });
const labels = item => itemEffectBadges(item).map(badge => badge.label);
function sample(ref, value) {
  const item = structuredClone(getItemDetails(2069));
  item.effects = [{ AilmentName: ref, InvocationValue: value, InvocationTurn: 0, DiseaseRate: 0 }];
  return item;
}

test('weapon power 130 and 120 display gains over the specified 100 baseline', () => {
  assert.deepEqual(labels(getItemDetails(2069)), ['物理技能威力 +30%']);
  assert.deepEqual(labels(sample('WEAPON_ABILITY_UP', 120)), ['物理技能威力 +20%']);
});

test('all six elemental power families share the percentage display rule', () => {
  for (const [element, name] of [['FIRE', '火'], ['ICE', '冰'], ['THUNDER', '雷'], ['WIND', '风'], ['LIGHT', '光'], ['DARK', '暗']]) {
    assert.deepEqual(labels(sample(`${element}_ABILITY_UP`, 130)), [`${name}属性威力 +30%`]);
    assert.deepEqual(labels(sample(`${element}_ABILITY_UP`, 120)), [`${name}属性威力 +20%`]);
  }
});

test('growth items use signed values and have no obsolete warning titles', () => {
  assert.deepEqual(labels(getItemDetails(1950)), ['最大HP +75']);
  assert.deepEqual(labels(getItemDetails(1956)), ['物攻 +7']);
  assert.deepEqual(labels(sample('GROW_MP', 3)), ['最大SP +3']);
  assert.deepEqual(labels(sample('GROW_DEF', -7)), ['物防 -7']);
  for (const item of allItems.filter(i => i.effects.some(e => e.AilmentName.startsWith('GROW_')))) {
    assert.ok(labels(item).some(label => / [+-]\d+$/.test(label)), item.id);
    assert.ok(itemEffectBadges(item).every(badge => badge.title === undefined), item.id);
  }
});

test('percentage normalization does not apply below the boundary or to unrelated effects', () => {
  for (const value of [100, 75]) assert.ok(labels(sample('WEAPON_ABILITY_UP', value)).every(label => !label.includes('%')));
  assert.deepEqual(labels(sample('GROW_HP', 130)), ['最大HP +130']);
  assert.deepEqual(labels(sample('HP_FIXED_RECOVERY', 130)), ['HP +130']);
  assert.deepEqual(labels(sample('ENCOUNT_UP', 130)), ['遇敌增加 · 130']);
});

test('formatting preserves source values and existing recovery/status badges', () => {
  const before = JSON.stringify(allItems);
  for (const item of allItems) itemEffectBadges(item);
  assert.equal(JSON.stringify(allItems), before);
  assert.equal(getItemDetails(2069).effects[0].InvocationValue, 130);
  assert.deepEqual(labels(getItemDetails(1904)), ['HP +500']);
  assert.deepEqual(labels(getItemDetails(1914)), ['HP/SP/BP 100%']);
  assert.deepEqual(labels(getItemDetails(1928)), ['中毒 3回合']);
});
