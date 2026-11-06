const mime = "application/x-ot2-save-slot";

// Per-component sessions: drops from another list, page or stale save state
// cannot reorder this array. Nothing is written until an accepted drop.
export function createSlotDrag() {
  let sequence = 0;
  let active: { scope: string; from: number; snapshot: string; token: string } | undefined;
  return {
    clear() { active = undefined; },
    start(event: DragEvent, scope: string, from: number, items: readonly unknown[]): boolean {
      active = undefined;
      const target = event.target;
      if (typeof Element !== "undefined" && target instanceof Element && target.closest("input, select, textarea, summary, button:not([data-drag-handle])")) {
        event.preventDefault(); return false;
      }
      if (!event.dataTransfer || !Number.isInteger(from) || from < 0 || from >= items.length) return false;
      active = { scope, from, snapshot: JSON.stringify(items), token: `${scope}:${++sequence}` };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(mime, active.token);
      return true;
    },
    over(event: DragEvent, scope: string): boolean {
      if (!active || active.scope !== scope || !event.dataTransfer || !Array.from(event.dataTransfer.types).includes(mime)) return false;
      event.preventDefault(); event.dataTransfer.dropEffect = "move"; return true;
    },
    drop(event: DragEvent, scope: string, to: number, items: readonly unknown[], move: (from: number, to: number) => void): boolean {
      const source = active;
      active = undefined;
      if (!source || source.scope !== scope || source.snapshot !== JSON.stringify(items)
        || event.dataTransfer?.getData(mime) !== source.token || !Number.isInteger(to) || to < 0 || to >= items.length) return false;
      event.preventDefault(); event.stopPropagation();
      move(source.from, to); return true;
    },
  };
}
