import catalogue from "../data/learnedAbilities.json";
import { int32, intArray, moveArrayItem, record, requireConfirmation, requireSlot, sameArray, type SaveChange, type SaveData } from "./save-feature-state";

export interface LearnedAbilityInfo { name: string; abilitySetId: number; spCost: number; costType: string; description: string }
export const learnedAbilityCatalogue: Readonly<Record<string, LearnedAbilityInfo>> = catalogue;
export function learnedAbilityCostLabel(info: LearnedAbilityInfo): string {
  if (info.costType === "EABILITY_COST_TYPE::eMONEY") return `叶币 ${info.spCost}`;
  if (info.costType === "EABILITY_COST_TYPE::eMP_RATIO") return `SP ${info.spCost}%`;
  return `SP ${info.spCost}`;
}
export const learnedAbilityOptions = Object.values(catalogue).map(v => ({ id: v.abilitySetId, name: v.name }));
export const learnedAbilityLabel = (id: number): string => id === -1 ? "空槽" : learnedAbilityCatalogue[id]?.name ?? `未知 (ID: ${id})`;

// Reads never initialize missing fields, normalize lengths or touch backups.
export function readLearnAbilityList(save: SaveData): number[] | undefined {
  return record(save) ? intArray(save.LearnAbilityList) : undefined;
}
export function readBackupLearnAbilities(save: SaveData): number[] | undefined {
  return record(save) && record(save.BackupLearnAbility) ? intArray(save.BackupLearnAbility.Org_LearnAbility) : undefined;
}
function requireCurrent(save: SaveData): number[] {
  const skills = readLearnAbilityList(save);
  if (!skills) throw new Error("存档缺少有效的 LearnAbilityList，未修改数据。");
  return skills;
}
function replace<T extends SaveData>(save: T, skills: number[]): SaveChange<T> {
  if (sameArray(requireCurrent(save), skills)) return { data: save, changed: false };
  return { data: { ...save, LearnAbilityList: [...skills] }, changed: true };
}
export function setLearnedAbility<T extends SaveData>(save: T, index: number, value: unknown): SaveChange<T> {
  const skills = requireCurrent(save), id = int32(value);
  requireSlot(skills.length, index);
  // An imported unknown value may be retained, but cannot be newly assigned.
  if (id !== skills[index] && id !== -1 && !Object.hasOwn(learnedAbilityCatalogue, id)) throw new Error("请选择字典中的 AbilitySetID 或空槽 -1。");
  skills[index] = id;
  return replace(save, skills);
}
export function appendLearnedSlot<T extends SaveData>(save: T): SaveChange<T> {
  return replace(save, [...requireCurrent(save), -1]);
}
export function moveLearnedSlot<T extends SaveData>(save: T, from: number, to: number): SaveChange<T> {
  return replace(save, moveArrayItem(requireCurrent(save), from, to));
}
export function removeLearnedSlot<T extends SaveData>(save: T, index: number, confirmed = false): SaveChange<T> {
  const skills = requireCurrent(save);
  requireSlot(skills.length, index);
  if (skills.length <= 5) throw new Error("至少保留默认 5 槽；可使用清空槽位。");
  requireConfirmation(confirmed);
  skills.splice(index, 1);
  return replace(save, skills);
}
export function resizeLearnedSlots<T extends SaveData>(save: T, length: number, confirmed = false): SaveChange<T> {
  const skills = requireCurrent(save);
  if (!Number.isSafeInteger(length) || length < 5) throw new Error("目标长度至少为 5 槽。");
  if (length < skills.length) requireConfirmation(confirmed);
  return replace(save, Array.from({ length }, (_, i) => skills[i] ?? -1));
}

// These functions are called ONLY by the two explicit backup-management actions.
export function syncToBackup<T extends SaveData>(save: T, confirmed = false): SaveChange<T> {
  requireConfirmation(confirmed);
  const skills = requireCurrent(save), backup = readBackupLearnAbilities(save);
  if (!backup || !record(save.BackupLearnAbility)) throw new Error("存档缺少有效剧情备份，未创建或覆盖字段。");
  if (sameArray(skills, backup)) return { data: save, changed: false };
  return { data: { ...save, BackupLearnAbility: { ...save.BackupLearnAbility, Org_LearnAbility: [...skills] } }, changed: true };
}
export function restoreFromBackup<T extends SaveData>(save: T, confirmed = false): SaveChange<T> {
  requireConfirmation(confirmed);
  const backup = readBackupLearnAbilities(save);
  if (!backup) throw new Error("存档缺少有效剧情备份。");
  return replace(save, [...backup]);
}
