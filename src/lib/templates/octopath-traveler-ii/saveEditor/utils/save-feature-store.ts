import { get } from "svelte/store";
import { dataJson, isDirty } from "$lib/stores";
import type { SaveChange, SaveData } from "./save-feature-state";

// Side effects live here; data helpers remain pure and never import a store.
export function editSave(transform: (save: SaveData) => SaveChange): void {
  const change = transform(get(dataJson));
  if (change.changed) {
    dataJson.set(change.data);
    isDirty.set(true);
  }
}
