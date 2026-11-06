import catalogue from "../data/items.json";

export type ItemDetails = (typeof catalogue.items)[number];
export type RawEffect = ItemDetails["effects"][number];
export type Stat = "HP" | "MP" | "BP" | "SP" | "POT" | "ATK" | "DEF" | "MATK" | "MDEF" | "ACC" | "EVA" | "CON" | "AGI";
export const statLabels: Record<Stat, string> = {
  HP: "HP", MP: "SP（MP）", BP: "BP（内部字段）", SP: "SP（内部字段）", POT: "POT（内部字段）",
  ATK: "物理攻击", MATK: "属性攻击", DEF: "物理防御", MDEF: "属性防御",
  ACC: "命中", EVA: "回避", CON: "暴击", AGI: "行动速度",
};
export const categoryNames = ["道具", "剑", "长枪", "短剑", "斧头", "弓", "杖", "护盾", "防具 头部", "防具 身体", "饰品", "调合素材", "贵重物品", "情报"];
const equipmentNames: Record<string, string> = { eSWORD: "剑", eLANCE: "长枪", eDAGGER: "短剑", eAXE: "斧头", eBOW: "弓", eROD: "杖", eSHIELD: "护盾", eLIGHT_HELMET: "头部防具", eLIGHT_ARMOR: "身体防具", eACCESSORY: "饰品" };
export function gameCategoryName(item: ItemDetails): string {
  if (item.stats) return `装备 ${equipmentNames[item.equipmentCategory.split("::")[1]] || item.equipmentCategory}`;
  return item.gameCategory.endsWith("::eCONSUMABLE") ? "消耗品 道具" : categoryNames[item.editorCategory];
}
export const itemCatalogue = catalogue;
export const allItems: readonly ItemDetails[] = catalogue.items;
const byId = new Map(allItems.map(item => [item.id, item]));
export const getItemDetails = (id: number | string): ItemDetails | undefined => byId.get(Number(id));
export function itemLabel(id: string, fallback = ""): string {
  const item = getItemDetails(id);
  return item ? `${item.zhCN}（${item.en}）` : fallback;
}
const effectLabels: Record<string, string> = {
  HP_FIXED_RECOVERY: "固定 HP 恢复", MP_FIXED_RECOVERY: "固定 SP 恢复", BP_RECOVERY: "BP 恢复",
  HP_RATIO_RECOVERY: "比例 HP 恢复", MP_RATIO_RECOVERY: "比例 SP 恢复",
  REVIVE_FIX: "复活固定恢复", HP_FIXED_DAMAGE: "固定伤害基础参数",
  WEAPON_ABILITY_UP: "武器威力增益", FIRE_ABILITY_UP: "火属性增益", ICE_ABILITY_UP: "冰属性增益",
  THUNDER_ABILITY_UP: "雷属性增益", WIND_ABILITY_UP: "风属性增益", LIGHT_ABILITY_UP: "光属性增益", DARK_ABILITY_UP: "暗属性增益",
  ADD_POISON_NORMAL: "附加中毒", ADD_SLEEP_NORMAL: "附加睡眠", ADD_BLIND_NORMAL: "附加黑暗", ADD_CONFUSION_NORMAL: "附加混乱",
  ADD_DEF_DOWN: "降低物理防御", ADD_MDEF_DOWN: "降低属性防御", ADD_EVA_DOWN: "降低回避",
  ADD_MP_FIXED_REGENERATION: "每回合 SP 恢复", ADD_HP_FIXED_REGENERATION: "每回合 HP 恢复",
  ENCOUNT_UP: "遇敌增加", ENCOUNT_DOWN: "遇敌减少",
  FIRE_RESIST: "火属性抗性", ICE_RESIST: "冰属性抗性", THUNDER_RESIST: "雷属性抗性",
  WIND_RESIST: "风属性抗性", LIGHT_RESIST: "光属性抗性", DARK_RESIST: "暗属性抗性",
};
export function effectLabel(ref: string): string { return effectLabels[ref] || ref; }
export function effectSummary(effect: RawEffect): string {
  const units: Record<string, string> = { HP_FIXED_RECOVERY: "HP", MP_FIXED_RECOVERY: "SP", BP_RECOVERY: "BP", REVIVE_FIX: "HP" };
  return units[effect.AilmentName]
    ? `${effectLabel(effect.AilmentName)}：基础值 ${effect.InvocationValue} ${units[effect.AilmentName]}`
    : `${effectLabel(effect.AilmentName)}：原始参数 ${effect.InvocationValue}`;
}
export const activeEffects = (effects: readonly RawEffect[]) => effects.filter(e => e.AilmentName !== "None");
function referenceKeywords(item: ItemDetails): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  function visit(ref: string, kind: "abilities" | "preparations") {
    if (ref === "None" || seen.has(`${kind}:${ref}`)) return;
    seen.add(`${kind}:${ref}`);
    const row = (catalogue[kind] as Record<string, { effects: RawEffect[]; enhanced?: RawEffect[]; random: boolean }>)[ref];
    if (!row) return;
    terms.push(ref);
    for (const e of activeEffects([...row.effects, ...(row.enhanced || [])])) {
      terms.push(e.AilmentName, effectLabel(e.AilmentName));
      if (row.random) visit(e.AilmentName, kind);
    }
  }
  visit(item.abilityRef, "abilities");
  item.contexts.forEach(ref => visit(ref, "preparations"));
  return terms.join(" ");
}
const searchText = new Map(allItems.map(i => [i.id, [i.id, i.zhCN, i.en, categoryNames[i.editorCategory], gameCategoryName(i), i.gameCategory, i.equipmentCategory,
  i.description || "", ...activeEffects(i.effects).flatMap(e => [e.AilmentName, effectLabel(e.AilmentName)]),
  ...Object.entries(i.stats || {}).filter(([, value]) => value !== 0).flatMap(([key]) => [key, statLabels[key as Stat]]), referenceKeywords(i),
  ...i.attributeResist.filter(r => !r.endsWith("::eNONE")), i.diseaseResist.some(Boolean) ? "抗性 异常状态抗性" : "",
].join(" ").toLocaleLowerCase()]));
export function matchesItem(item: ItemDetails, query = "", category = -1, stat = "", effectOnly = false): boolean {
  return (category === -1 || item.editorCategory === category)
    && (!stat || (item.stats !== null && (item.stats[stat as Stat] ?? 0) !== 0))
    && (!effectOnly || activeEffects(item.effects).length > 0 || item.attributeResist.some(r => !r.endsWith("::eNONE")) || item.diseaseResist.some(Boolean) || item.abilityRef !== "None" || item.contexts.length > 0)
    && query.trim().toLocaleLowerCase().split(/\s+/).every(word => searchText.get(item.id)!.includes(word));
}
