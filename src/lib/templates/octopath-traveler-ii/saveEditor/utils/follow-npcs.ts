import catalogue from "../data/followNpcs.json";
import ownerData from "../data/followNpcOwners.json";
import { int32, moveArrayItem, record, requireSlot, type SaveChange, type SaveData } from "./save-feature-state";

export type FollowListKey = "FollowNpcSaveData" | "FollowWaitingNpcSaveData";
export interface FollowNpcSlot { NpcUniqueID: number; SupportLimit: number; FieldCommandType: number; MasterCharacterID: number }
export interface FollowNpcSkill { abilityRef: string; name: string; description: string; descriptionSource: string; unresolvedEffects: string[] }
export interface FollowNpcInfo { npcUniqueId: number; name: string; town: string; rank: number | null; skillDesc: string; skills: FollowNpcSkill[]; defaultSupportLimit: number | null; skillNames: string[]; unlimited: boolean }
export interface FollowOwner { characterId: number; name: string; fieldCommandType: number; commandName: string }
export const followNpcCatalogue: Readonly<Record<string, FollowNpcInfo>> = catalogue;
export const followOwners: Readonly<Record<string, FollowOwner>> = ownerData;
export const followCommandLabel = (type: number): string => Object.values(followOwners).find(owner => owner.fieldCommandType === type)?.commandName ?? `未知指令（${type}）`;
export const followNpcOptions = Object.values(followNpcCatalogue).map(npc => ({ id: npc.npcUniqueId, name: `${npc.name} · ${npc.town}` }));
export const followNpcLabel = (id: number): string => id === -1 ? "空槽" : followNpcCatalogue[id] ? `${followNpcCatalogue[id].name} · ${followNpcCatalogue[id].town}` : `未知 (ID: ${id})`;
const keys = ["NpcUniqueID", "SupportLimit", "FieldCommandType", "MasterCharacterID"] as const;
const emptySlot = (): FollowNpcSlot => ({ NpcUniqueID: -1, SupportLimit: 0, FieldCommandType: 0, MasterCharacterID: 0 });

export function readFollowNpcList(save: SaveData, list: FollowListKey): FollowNpcSlot[] | undefined {
  if (!record(save) || !["FollowNpcSaveData", "FollowWaitingNpcSaveData"].includes(list)) return undefined;
  const values = save[list];
  if (!Array.isArray(values) || values.length !== 4) return undefined;
  const result: FollowNpcSlot[] = [];
  for (const value of values) {
    if (!record(value) || Object.keys(value).length !== 4) return undefined;
    try { for (const key of keys) { if (typeof value[key] !== "number") return undefined; int32(value[key]); } }
    catch { return undefined; }
    result.push({ NpcUniqueID: value.NpcUniqueID as number, SupportLimit: value.SupportLimit as number,
      FieldCommandType: value.FieldCommandType as number, MasterCharacterID: value.MasterCharacterID as number });
  }
  return result;
}
export function readCharacterFollowNpcs(save: SaveData, characterId: number) {
  const owned = (list: FollowListKey) => readFollowNpcList(save, list)?.map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.NpcUniqueID !== -1 && slot.MasterCharacterID === characterId);
  return { current: owned("FollowNpcSaveData"), waiting: owned("FollowWaitingNpcSaveData") };
}
export function canEditFollowSlot(slot: FollowNpcSlot, characterId: number): boolean {
  return !!followOwners[characterId] && (slot.NpcUniqueID === -1 || slot.MasterCharacterID === characterId);
}
function requireList(save: SaveData, list: FollowListKey): FollowNpcSlot[] {
  const slots = readFollowNpcList(save, list);
  if (!slots) throw new Error("随行列表不是有效的共享 4 槽结构，已保留原始数据。");
  return slots;
}
function requireEditable(slots: FollowNpcSlot[], index: number, characterId: number): FollowOwner {
  requireSlot(slots.length, index);
  if (!canEditFollowSlot(slots[index], characterId)) throw new Error("此记录属于其他角色；请到所属角色的页签编辑。");
  return followOwners[characterId];
}
function commit<T extends SaveData>(save: T, list: FollowListKey, slots: FollowNpcSlot[]): SaveChange<T> {
  const original = requireList(save, list);
  if (slots.every((slot, i) => keys.every(key => slot[key] === original[i][key]))) return { data: save, changed: false };
  return { data: { ...save, [list]: slots }, changed: true };
}
export function setFollowNpc<T extends SaveData>(save: T, list: FollowListKey, index: number, value: unknown, characterId: number): SaveChange<T> {
  const slots = requireList(save, list), owner = requireEditable(slots, index, characterId), id = int32(value), old = slots[index];
  if (id === old.NpcUniqueID) return { data: save, changed: false };
  if (id === -1) slots[index] = emptySlot();
  else {
    const npc = followNpcCatalogue[id];
    if (!npc) throw new Error("请选择字典中的 NPC 唯一 ID；未识别的原有 ID 将保留。");
    // Only explicitly filling an empty slot assigns the current owner/command.
    // Replacing an occupied NPC preserves the saved count and command exactly.
    slots[index] = old.NpcUniqueID === -1 ? { NpcUniqueID: id, SupportLimit: npc.defaultSupportLimit ?? 0,
      FieldCommandType: owner.fieldCommandType, MasterCharacterID: owner.characterId } : { ...old, NpcUniqueID: id };
  }
  return commit(save, list, slots);
}
export function setFollowSupportLimit<T extends SaveData>(save: T, list: FollowListKey, index: number, value: unknown, characterId: number): SaveChange<T> {
  const slots = requireList(save, list); requireEditable(slots, index, characterId);
  if (slots[index].NpcUniqueID === -1) throw new Error("请先选择 NPC。");
  const limit = int32(value);
  if (limit <= 0) throw new Error("召唤次数请输入 1 至 2147483647 的正整数；原有值未改变。");
  slots[index] = { ...slots[index], SupportLimit: limit };
  return commit(save, list, slots);
}
export function clearFollowNpcSlot<T extends SaveData>(save: T, list: FollowListKey, index: number, characterId: number): SaveChange<T> {
  const slots = requireList(save, list); requireEditable(slots, index, characterId);
  slots[index] = emptySlot(); return commit(save, list, slots);
}
export function moveFollowNpcSlot<T extends SaveData>(save: T, list: FollowListKey, from: number, to: number): SaveChange<T> {
  return commit(save, list, moveArrayItem(requireList(save, list), from, to));
}
export function swapFollowNpcSlots<T extends SaveData>(save: T, list: FollowListKey, a: number, b: number): SaveChange<T> {
  const slots = requireList(save, list); requireSlot(slots.length, a); requireSlot(slots.length, b);
  [slots[a], slots[b]] = [slots[b], slots[a]];
  return commit(save, list, slots);
}
