import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../src/lib/templates/octopath-traveler-ii/saveEditor/utils/monster-description.ts', import.meta.url), 'utf8');
const exports = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports);
const { describeMonsterSkills } = exports;
const catalogue = JSON.parse(fs.readFileSync(new URL('../../src/lib/templates/octopath-traveler-ii/saveEditor/data/monsters.json', import.meta.url)));

for (const id of [2320, 2118, 2462]) {
  test(`screenshot example ${id}: one title, attack summary, then summon restriction`, () => {
    const row = catalogue[id], before = structuredClone(row), result = describeMonsterSkills(row);
    assert.equal(result.skills.length, 1);
    assert.equal(result.skills[0].name, row.skillName);
    assert.equal(result.skills[0].description.includes(row.skillName), false);
    assert.equal(result.notes, '※战斗中只能召唤一次。');
    assert.deepEqual(row, before);
    if (id === 2462) assert.equal(result.skills[0].description, '杖 / 敌方单体物理攻击');
  });
}

test('multiple skills retain each name and its own attack summary once', () => {
  assert.deepEqual(describeMonsterSkills({ skillName: '苍风 / 苍光', skillDesc: '苍风（风）\n苍光（光）\n苍风：风属性 / 敌方全体属性攻击\n苍光：光属性 / 敌方全体属性攻击' }), {
    skills: [{ name: '苍风', description: '风属性 / 敌方全体属性攻击\n（风）' }, { name: '苍光', description: '光属性 / 敌方全体属性攻击\n（光）' }], notes: '',
  });
});

test('multiline names, pattern characters and meaningful effect text are preserved', () => {
  const name = '技能（甲）+?\n第二行';
  const result = describeMonsterSkills({ skillName: name, skillDesc: `${name}\n${name}：特殊召唤行动\n施加技能（甲）+?效果2回合。` });
  assert.deepEqual(result, { skills: [{ name, description: '特殊召唤行动' }], notes: '施加技能（甲）+?效果2回合。' });
});

test('ordinary single skills and empty descriptions remain readable', () => {
  assert.deepEqual(describeMonsterSkills({ skillName: '毒针乱射', skillDesc: '毒针乱射：弓 / 敌方全体物理攻击' }), {
    skills: [{ name: '毒针乱射', description: '弓 / 敌方全体物理攻击' }], notes: '',
  });
  assert.deepEqual(describeMonsterSkills({ skillName: '技能', skillDesc: '' }), { skills: [{ name: '技能', description: '' }], notes: '' });
});
