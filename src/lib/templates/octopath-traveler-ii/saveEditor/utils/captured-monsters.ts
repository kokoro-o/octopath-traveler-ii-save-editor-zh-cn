import catalogue from "../data/monsters.json";
import { int32, moveArrayItem, record, requireSlot, type SaveChange, type SaveData } from "./save-feature-state";

export type MonsterListKey = "TameMonsterList" | "LegendMonsterList";
export interface MonsterSlot { EnemyID: number; Count: number; Used: boolean }
export interface MonsterInfo {
  name: string; enemyId: number; invadeId: number; category: string;
  displayLevel: number; countMin: number; countMax: number; unlimited: boolean;
  rank: number; skillName: string; skillDesc: string; meatItem: string;
}
export const monsterCatalogue: Readonly<Record<string, MonsterInfo>> = catalogue;
export const monsterLabel = (id: number): string => id === -1 ? "空槽" : monsterCatalogue[id]?.name ?? `未知 (ID: ${id})`;
export function monsterOptions(list: MonsterListKey): { id: number; name: string }[] {
  return Object.values(monsterCatalogue).filter(m => list === "LegendMonsterList" ? m.category === "legend" : ["normal", "partner"].includes(m.category))
    .map(m => ({ id: m.enemyId, name: m.name }));
}
export function readMonsterList(save: SaveData, list: MonsterListKey): MonsterSlot[] | undefined {
  if (!record(save) || !["TameMonsterList", "LegendMonsterList"].includes(list)) return undefined;
  const slots = save[list];
  if (!Array.isArray(slots) || slots.length !== 10) return undefined;
  const result: MonsterSlot[] = [];
  for (const slot of slots) {
    // Unsupported schemas are preserved untouched, not normalized into three fields.
    if (!record(slot) || Object.keys(slot).length !== 3 || typeof slot.EnemyID !== "number" || typeof slot.Count !== "number" || typeof slot.Used !== "boolean") return undefined;
    try { int32(slot.EnemyID); int32(slot.Count); } catch { return undefined; }
    result.push({ EnemyID: slot.EnemyID, Count: slot.Count, Used: slot.Used });
  }
  return result;
}
export function updateMonsterSlot<T extends SaveData>(save: T, list: MonsterListKey, index: number, patch: Partial<MonsterSlot>): SaveChange<T> {
  const slots = readMonsterList(save, list);
  if (!slots) throw new Error("此魔物列表不是有效的 10 槽结构，已保留原始数据。");
  requireSlot(slots.length, index);
  if (!record(patch) || Object.keys(patch).some(k => !["EnemyID", "Count", "Used"].includes(k))) throw new Error("魔物只支持 EnemyID、Count、Used 三个字段。");
  const old = slots[index], next = { ...old };
  if (Object.hasOwn(patch, "EnemyID")) {
    const id = int32(patch.EnemyID), info = monsterCatalogue[id];
    if (id !== old.EnemyID && id !== -1 && (!info || (list === "LegendMonsterList" ? info.category !== "legend" : !["normal", "partner"].includes(info.category)))) throw new Error("请选择此列表分类中的魔物或空槽。");
    next.EnemyID = id;
    if (id === -1) { next.Count = 0; next.Used = false; }
  }
  if (Object.hasOwn(patch, "Count")) next.Count = int32(patch.Count);
  if (Object.hasOwn(patch, "Used")) {
    if (typeof patch.Used !== "boolean") throw new Error("Used 必须为布尔值。");
    next.Used = patch.Used;
  }
  if (next.EnemyID === old.EnemyID && next.Count === old.Count && next.Used === old.Used) return { data: save, changed: false };
  slots[index] = next;
  return { data: { ...save, [list]: slots }, changed: true };
}
export function clearMonsterSlot<T extends SaveData>(save: T, list: MonsterListKey, index: number): SaveChange<T> {
  return updateMonsterSlot(save, list, index, { EnemyID: -1, Count: 0, Used: false });
}
export function moveMonsterSlot<T extends SaveData>(save: T, list: MonsterListKey, from: number, to: number): SaveChange<T> {
  const slots = readMonsterList(save, list);
  if (!slots) throw new Error("此魔物列表不是有效的 10 槽结构，已保留原始数据。");
  const moved = moveArrayItem(slots, from, to);
  const unchanged = slots.every((v, i) => v.EnemyID === moved[i].EnemyID && v.Count === moved[i].Count && v.Used === moved[i].Used);
  return unchanged ? { data: save, changed: false } : { data: { ...save, [list]: moved }, changed: true };
}
