export type SaveData = Record<string, unknown>;
export interface SaveChange<T extends SaveData = SaveData> {
  data: T;
  changed: boolean;
}

export function int32(value: unknown): number {
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value)) throw new Error("请输入完整整数；此输入未应用。");
    value = Number(value);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new Error("整数范围为 -2147483648 至 2147483647；此输入未应用。");
  }
  return value;
}

export function record(value: unknown): value is SaveData {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Map);
}

export function intArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || !value.every(v => typeof v === "number" && Number.isInteger(v) && v >= -2147483648 && v <= 2147483647)) return undefined;
  return [...value];
}

export function sameArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function requireSlot(length: number, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error("槽位不存在。");
}

export function moveArrayItem<T>(items: readonly T[], from: number, to: number): T[] {
  requireSlot(items.length, from);
  requireSlot(items.length, to);
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function requireConfirmation(confirmed: boolean): void {
  if (confirmed !== true) throw new Error("此操作需要先确认。");
}
