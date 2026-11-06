import { activeEffects, effectLabel, itemCatalogue, type ItemDetails, type RawEffect, type Stat } from "./item-details";
export const compactStatLabels: Record<Stat, string> = {
  HP: "HP", MP: "SP", BP: "BP（内部）", SP: "SP（内部）", POT: "POT（内部）",
  ATK: "物攻", DEF: "物防", MATK: "属攻", MDEF: "属防", ACC: "命中", EVA: "回避", CON: "暴击", AGI: "速度",
};
export function nonzeroStats(item: ItemDetails) {
  return Object.entries(item.stats || {}).filter(([, value]) => value !== 0).map(([key, value]) => ({ key, label: compactStatLabels[key as Stat], value }));
}

export interface EffectBadge {
  label: string;
  tone: "recovery" | "raw" | "damage" | "status" | "mixing";
  title?: string;
}

const growthNames: Record<string, string> = { HP: "最大HP", MP: "最大SP", ATK: "物攻", DEF: "物防", MATK: "属攻", MDEF: "属防", ACC: "命中", EVA: "回避", CON: "暴击", AGI: "速度", SCP: "外观" };
const powerNames: Record<string, string> = {
  WEAPON_ABILITY_UP: "物理技能威力", FIRE_ABILITY_UP: "火属性威力", ICE_ABILITY_UP: "冰属性威力",
  THUNDER_ABILITY_UP: "雷属性威力", WIND_ABILITY_UP: "风属性威力", LIGHT_ABILITY_UP: "光属性威力", DARK_ABILITY_UP: "暗属性威力",
};
const otherNames: Record<string, string> = {
  RECOVERY_POTENTIALITY_ACTION: "潜力恢复", ENCOUNT_UP: "遇敌增加", ENCOUNT_DOWN: "遇敌减少",
  TARGET_RATE_CONTROL: "受击倾向", AVOID_RECEIVE_DECONDITION: "异常状态抗性", EXPUP: "EXP获得量", JPUP: "JP获得量", MONEYUP: "金钱获得量",
  ADD_RECEIVED_RECOVERY_HP_AND_SP: "HP/SP恢复量提升", CRITICAL_DAMAGE_RATIO_UP: "暴击伤害", ADD_DAMEGE_ON_BOOST: "增幅伤害",
  ADD_MAX_HP_UP: "战斗最大HP", HIT_OR_MISS: "命中后必定暴击", ADD_COUNTER_WEAPON: "反击", HP1: "HP效果", HP_RATIO_DAMAGE: "HP比例伤害",
  SP_DAMAGE: "护盾削减", ADD_HP_REGENERATION: "行动后恢复HP", ADD_MP_REGENERATION: "行动后恢复SP",
  ADD_ATK_UP: "物攻上升", ADD_MATK_UP: "属攻上升", ADD_DEF_UP: "物防上升", ADD_MDEF_UP: "属防上升", ADD_ACC_UP: "命中上升", ADD_CON_UP: "暴击上升", ADD_EVA_UP: "回避上升", ADD_AGI_UP: "速度上升",
  ADD_ATK_DOWN: "物攻下降", ADD_MATK_DOWN: "属攻下降", ADD_DEF_DOWN: "物防下降", ADD_MDEF_DOWN: "属防下降", ADD_ACC_DOWN: "命中下降", ADD_AGI_DOWN: "速度下降", ADD_EVA_DOWN: "回避下降",
  ADD_PROVOKE: "吸引攻击", ADD_SUPER_MAGIC: "大魔法化", ADD_FORCE_CRITICAL: "被命中时必定暴击",
  INSTANT_DEATH: "即死", ADD_DOUBLE_ATTAK_THUNDER: "雷属性追击", RECOVERY_BP_ON_KILL: "击倒目标恢复BP",
  ADD_RANDOM_DISEASE_00: "随机异常状态", ADD_RANDOM_DEBUFF: "随机属性下降", INVERSION_MINUS_PARAMETER: "负属性转为正属性",
  DOWN_BACK_ATTACK_RATE: "防止偷袭", ADD_DAMAGE_ON_PINCH: "低HP伤害增益", RARE_CAT_ENCOUNT_UP: "凯特林遇敌增加", RARE_OCTOPUS_ENCOUNT_UP: "奥克托林遇敌增加",
};
const statusNames: Record<string, string> = { POISON: "中毒", SILENCE: "沉默", BLIND: "黑暗", CONFUSION: "混乱", SLEEP: "睡眠", FEAR: "恐惧", STUN: "晕厥", STONE: "石化", DECONDITION: "异常状态" };

/** Owner-specified display rules: signed growth and power gain over a 100 baseline. */
export function itemEffectBadges(item: ItemDetails): EffectBadge[] {
  const badges: EffectBadge[] = [];
  const add = (label: string, tone: EffectBadge["tone"], context = "", title?: string) => badges.push({ label: context ? `${context} · ${label}` : label, tone, title });
  function append(effects: RawEffect[], context = "", attribute = item.attribute, description = "") {
  const active = activeEffects(effects);
  const fullRecovery = description.includes("全部HP/SP/BP")
    && active.some(e => e.AilmentName === "HP_RATIO_RECOVERY" && e.InvocationValue === 100)
    && active.some(e => e.AilmentName === "MP_RATIO_RECOVERY" && e.InvocationValue === 100)
    && active.some(e => e.AilmentName === "BP_RECOVERY" && e.InvocationValue === 5);
  if (fullRecovery) add("HP/SP/BP 100%", "recovery", context);
  for (const effect of active) {
    const ref = effect.AilmentName;
    const value = effect.InvocationValue;
    const unit = { HP_FIXED_RECOVERY: "HP", MP_FIXED_RECOVERY: "SP", BP_RECOVERY: "BP" }[ref];
    if (fullRecovery && ["HP_RATIO_RECOVERY", "MP_RATIO_RECOVERY", "BP_RECOVERY"].includes(ref)) continue;
    if (unit) add(`${unit} ${value >= 0 ? "+" : ""}${value}`, "recovery", context);
    else if (ref.startsWith("GROW_")) {
      add(`${growthNames[ref.slice(5)] || ref.slice(5)} ${value >= 0 ? "+" : ""}${value}`, "raw", context);
    } else if (powerNames[ref] && value > 100) {
      add(`${powerNames[ref]} +${value - 100}%`, "raw", context);
    } else if (ref === "HP_FIXED_DAMAGE") {
      const elements: Record<string, string> = { eFIRE: "火", eICE: "冰", eTHUNDER: "雷", eWIND: "风", eLIGHT: "光", eDARK: "暗" };
      const element = elements[attribute.split("::")[1]] || "";
      add(`${element}属性伤害 ${value}`, "damage", context, "原始基础伤害值");
    } else if (ref.startsWith("ADD_") && /POISON|SLEEP|CONFUSION|BLIND/.test(ref)) {
      if (effect.InvocationTurn > 0) add(`${effectLabel(ref).replace(/^附加/, "")} ${effect.InvocationTurn}回合`, "status", context);
      // DiseaseRate is deliberately not rendered as an actual hit probability.
    } else if (ref === "HP_RATIO_RECOVERY" || ref === "MP_RATIO_RECOVERY") {
      const resource = ref === "HP_RATIO_RECOVERY" ? "HP" : "SP";
      const confirmedFull = value === 100 && (resource === "HP" ? /全部HP/.test(description) : /全部(?:HP\/)?SP/.test(description));
      add(confirmedFull ? `${resource} 100%` : `${resource}恢复 · ${value}`, confirmedFull ? "recovery" : "raw", context);
    } else if (ref === "REVIVE_FIX") {
      add(`复活 HP +${value}`, "recovery", context);
    } else if (ref.startsWith("REMOVE_")) {
      add(`治疗${statusNames[ref.slice(7)] || ref.slice(7)}`, "status", context);
    } else if (ref === "ADD_HP_FIXED_REGENERATION" || ref === "ADD_MP_FIXED_REGENERATION") {
      add(`行动后 ${ref.includes("_HP_") ? "HP" : "SP"} +${value}`, "recovery", context);
    } else if (ref === "NORMAL_ATTACK_PLUS") {
      add(`攻击次数 +${value}`, "status", context);
    } else if (ref === "ADD_DEBUFF_TURN" && effect.InvocationTurn > 0) {
      add(`弱化持续 +${effect.InvocationTurn}回合`, "status", context);
    } else if (ref === "ADD_BREAK_ATK_UP" && description.includes(`+${value}`)) {
      add(`破防时物攻 +${value}`, "status", context);
    } else if (["DRAIN_HP_ON_ATTACK", "DRAIN_SP_ON_ATTACK"].includes(ref) && description.includes(`${value}%`)) {
      add(`伤害吸收${ref === "DRAIN_HP_ON_ATTACK" ? "HP" : "SP"} ${value}%`, "recovery", context);
    } else {
      const name = ref === "WEAPON_ABILITY_UP" ? "物理技能威力" : otherNames[ref] || effectLabel(ref);
      add(`${name}${value !== 0 ? ` · ${value}` : ""}${effect.InvocationTurn > 0 ? ` · ${effect.InvocationTurn}回合` : ""}`, "raw", context, "原始效果值；未换算为倍率或百分比");
    }
  }
  }
  type LinkedEffects = { random: boolean; effects: RawEffect[]; enhanced?: RawEffect[]; attribute: string; time?: string };
  function visit(ref: string, kind: "abilities" | "preparations", context: string, visited: Set<string>) {
    if (ref === "None" || visited.has(ref)) return;
    const row = (itemCatalogue[kind] as Record<string, LinkedEffects>)[ref];
    if (!row) return;
    const next = new Set(visited).add(ref);
    const time = row.time?.endsWith("::eDAYTIME") ? "白天 " : row.time?.endsWith("::eNIGHT") ? "夜间 " : "";
    const show = (effects: RawEffect[], label: string) => {
      if (row.random) {
        add(`${label}随机效果`, "status");
        for (const effect of activeEffects(effects)) visit(effect.AilmentName, kind, `${label}随机`, next);
      } else append(effects, `${time}${label}`, row.attribute);
    };
    show(row.effects, context);
    if (row.enhanced) show(row.enhanced, "增强");
  }
  append(item.effects, "", item.attribute, item.description || "");
  visit(item.abilityRef, "abilities", "", new Set());
  for (const ref of item.contexts) visit(ref, "preparations", "调合", new Set());
  return badges.filter((badge, index, all) => all.findIndex(other => other.label === badge.label && other.tone === badge.tone) === index);
}
