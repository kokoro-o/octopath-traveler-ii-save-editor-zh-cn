import assert from 'node:assert/strict';
import { originalField } from './extract-and-validate.mjs';

const weapons = { eNONE: '', eSWORD: '剑', eLANCE: '长枪', eDAGGER: '短剑', eAXE: '斧头', eBOW: '弓', eROD: '杖' };
const attributes = { eFIRE: '火', eICE: '冰', eTHUNDER: '雷', eWIND: '风', eLIGHT: '光', eDARK: '暗' };
const targets = { eSELF: '自身', eENEMY_SINGLE: '敌方单体', eENEMY_ALL: '敌方全体', ePARTY_SINGLE: '我方单体', ePARTY_ALL: '我方全体',
  eENFORCER: '施术者', eOWNER: '随行 NPC 所属角色', eCHASE: '命中目标', eRANDOM: '随机目标', eCHARACTER_ALL: '全体角色',
  eHP_LOWEST: 'HP 最低的目标', eHP_HIGHEST: 'HP 最高的目标', eEXCEPT_ENFORCER: '施术者以外的目标', eRANDOM_EXCEPT_ENFORCER: '施术者以外的随机目标' };
const enumKey = value => value?.split('::')[1];

/** Prefer an explicit official Detail reference. Never borrow a same-name skill's
 * text: guest, learned and supporter versions can have different targets/turns.
 * Fallbacks describe data fields only, not sequence-driven hit counts/formulas. */
export function describeFollowSkill(ref, tables, stack = []) {
  assert.ok(!stack.includes(ref) && stack.length < 8, `Recursive support ability: ${ref}`);
  const ability = tables.AbilityData.rows[ref];
  if (!ability) return undefined;
  const text = key => tables.GameTextZH_CN.rows[key]?.Text?.value ?? '';
  const name = text(ability.DisplayName);
  if (!name.trim()) return undefined;
  const official = text(ability.Detail);
  if (ability.Detail !== 'None' && official.trim()) return { abilityRef: ref, name, description: official, descriptionSource: 'official', unresolvedEffects: [] };
  const lines = [], unresolvedEffects = [];
  const target = targets[enumKey(ability.TargetType)], weapon = weapons[enumKey(ability.RestrictWeapon)];
  if (target) lines.push(`对象：${target}${weapon ? `；武器：${weapon}` : ''}。`);
  const random = ability.CommandActor?.assetPath?.includes('RandomSelectAbility');
  for (const effect of ability.Ailment ?? []) {
    const effectRef = effect.AilmentName;
    if (effectRef === 'None') continue;
    if (random) {
      const nested = describeFollowSkill(effectRef, tables, [...stack, ref]);
      if (nested) { lines.push(`随机效果之一：${nested.name}\n${nested.description}`); unresolvedEffects.push(...nested.unresolvedEffects); }
      else unresolvedEffects.push(effectRef);
      continue;
    }
    const row = tables.AilmentData.rows[effectRef];
    assert.ok(row, `Missing support effect: ${ref}: ${effectRef}`);
    const field = key => originalField(row, key);
    const targetKey = tables.followEffectTargets[enumKey(field('Target'))];
    const effectTarget = targetKey === 'eDEPEND' ? target : targets[targetKey];
    const prefix = effectTarget ? `${effectTarget}：` : '';
    const turn = effectRef.includes('RANDAMCOUNT') ? '（持续回合数随机）' : effect.InvocationTurn > 0 ? `（${effect.InvocationTurn}回合）` : '';
    const rate = effect.DiseaseRate > 0 && effect.DiseaseRate < 100 ? `（基础触发率${effect.DiseaseRate}%）` : '';
    // These statuses have no official Detail text; the action carries the value.
    const special = { ADD_ANALYZE: `揭示${effect.InvocationValue}个弱点。`, EXPUP: '获得经验值增加。', JPUP: '获得 JP 增加。' }[effectRef];
    if (special) { lines.push(`${prefix}${special}${turn}`); continue; }
    const diseases = field('AddDisease').filter(d => originalField(d, 'DiseaseName') !== 'None');
    if (diseases.length) {
      for (const disease of diseases) {
        const diseaseRef = originalField(disease, 'DiseaseName'), status = tables.DiseaseData.rows[diseaseRef];
        assert.ok(status, `Missing support disease: ${ref}: ${diseaseRef}`);
        const detail = text(originalField(status, 'Detail'));
        if (detail.trim()) lines.push(`${prefix}${detail}${turn}${rate}`);
        else unresolvedEffects.push(effectRef);
      }
      continue;
    }
    let description;
    if (/^(RANDOM_TARGET_)?PHYSICS_DAMAGE(_ALL)?$/.test(effectRef)) description = '造成物理伤害。';
    else if (/^(RANDOM_TARGET_)?MAGIC_DAMAGE(_(FIRE|ICE|THUNDER|WIND|LIGHT|DARK))?$/.test(effectRef)) description = `造成${attributes[`e${effectRef.split('_').at(-1)}`] ?? ''}属性伤害。`;
    else if (effectRef === 'HP_FIXED_RECOVERY') description = `恢复${effect.InvocationValue} HP。`;
    else if (effectRef === 'MP_FIXED_RECOVERY') description = `恢复${effect.InvocationValue} SP。`;
    else if (effectRef === 'HP_FIXED_DAMAGE') description = `造成${effect.InvocationValue}点固定伤害。`;
    else if (effectRef === 'HP_RECOVERY') description = '恢复 HP。';
    else if (effectRef === 'BP_RECOVERY') description = `恢复${effect.InvocationValue} BP。`;
    else if (effectRef === 'MP_RATIO_RECOVERY') description = `按比例恢复 SP（配置值：${effect.InvocationValue}）。`;
    else if (effectRef === 'HP_SELF_DAMAGE') description = '消耗自身 HP。';
    else if (effectRef === 'SP_DAMAGE' || effectRef === 'SP_DAMAGE_DIRECT') description = `削减${effect.InvocationValue}点护盾。`;
    else if (effectRef === 'INSTANT_DEATH') description = `施加即死效果。${rate}`;
    else if (effectRef === 'ORDER_COUNT_DOWN' || effectRef === 'ORDER_COUNT_UP_CHASE') description = '改变行动顺序。';
    else if (effectRef === 'REMOVE_DECONDITION') description = '消除异常状态。';
    else if (effectRef === 'REMOVE_OLDEST_DEBUFF') description = `消除${effect.InvocationValue}个较早施加的能力下降效果。`;
    else if (effectRef === 'STEAL_MONEY' || effectRef === 'GET_LUCKY_MONEY') description = '从目标处获得金钱。';
    else if (effectRef === 'STEAL_ITEM') description = '偷取道具。';
    else if (effectRef.startsWith('REMOVE_')) {
      const status = tables.DiseaseData.rows[field('TargetDiseaseName')];
      const detail = status && text(originalField(status, 'Detail'));
      if (detail) description = `消除状态：${detail}`;
    }
    if (description) lines.push(`${prefix}${description}`);
    else unresolvedEffects.push(effectRef);
  }
  if (!lines.length || unresolvedEffects.length) lines.push('含特殊效果，当前仅展示已解析部分。');
  return { abilityRef: ref, name, description: [...new Set(lines)].join('\n'), descriptionSource: 'database', unresolvedEffects: [...new Set(unresolvedEffects)] };
}
