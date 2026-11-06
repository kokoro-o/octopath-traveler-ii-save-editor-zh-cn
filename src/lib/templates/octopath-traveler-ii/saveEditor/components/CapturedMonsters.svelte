<script lang="ts">
  import { dataJson } from "$lib/stores";
  import { clearMonsterSlot, monsterCatalogue, monsterLabel, monsterOptions, moveMonsterSlot, readMonsterList, updateMonsterSlot, type MonsterListKey, type MonsterSlot } from "../utils/captured-monsters";
  import { int32, type SaveChange, type SaveData } from "../utils/save-feature-state";
  import { editSave } from "../utils/save-feature-store";
  import SaveIdSelect from "./SaveIdSelect.svelte";
  import SlotOrder from "./SlotOrder.svelte";
  import { createSlotDrag } from "../utils/slot-drag";
  import { describeMonsterSkills } from "../utils/monster-description";
  import "./save-feature-rows.css";
  let list: MonsterListKey = "TameMonsterList";
  let error = "";
  const drag = createSlotDrag();
  let dropTarget: number | null = null;
  const normalOptions = monsterOptions("TameMonsterList"), legendOptions = monsterOptions("LegendMonsterList");
  $: slots = readMonsterList($dataJson, list);
  $: options = list === "TameMonsterList" ? normalOptions : legendOptions;
  function apply(action: (save: SaveData) => SaveChange) {
    try { editSave(action); error = ""; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  function patch(index: number, value: Partial<MonsterSlot>) { apply(s => updateMonsterSlot(s, list, index, value)); }
  function count(event: Event, index: number) {
    try { patch(index, { Count: int32((event.currentTarget as HTMLInputElement).value) }); }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  function normalizeCount(event: FocusEvent, index: number) {
    const current = readMonsterList($dataJson, list)?.[index];
    if (current) (event.currentTarget as HTMLInputElement).value = String(current.Count);
  }
  function move(from: number, to: number) { apply(s => moveMonsterSlot(s, list, from, to)); }
  function drop(event: DragEvent, to: number) {
    drag.drop(event, list, to, slots ?? [], move);
    dropTarget = null;
  }
  function selectList(next: MonsterListKey) { drag.clear(); dropTarget = null; list = next; error = ""; }
</script>

<div class="captured-monsters" data-save-feature="monsters">
  <p>欧修缇的捕获魔物；两个列表各保留 10 槽。更换种类会保留次数和 Used 标记，选择空槽则完整清空。</p>
  <div class="tabs" role="tablist" aria-label="魔物列表">
    <button type="button" role="tab" id="normal-monsters-tab" aria-selected={list === "TameMonsterList"} aria-controls="monster-slots-panel" on:click={() => selectList("TameMonsterList")}>普通魔物 (10 槽)</button>
    <button type="button" role="tab" id="legend-monsters-tab" aria-selected={list === "LegendMonsterList"} aria-controls="monster-slots-panel" on:click={() => selectList("LegendMonsterList")}>传说魔物 (10 槽)</button>
  </div>
  {#if error}<p role="alert">{error}</p>{/if}
  <div id="monster-slots-panel" role="tabpanel" aria-labelledby={list === "TameMonsterList" ? "normal-monsters-tab" : "legend-monsters-tab"}>
    {#if slots}
      {#key list}
        <div class="slots ot2-slot-rows" role="list" aria-label="捕获魔物槽位">
          {#each slots as slot, index (index)}
            <section class="slot ot2-slot-row" class:drop-target={dropTarget === index} role="listitem" aria-label={`魔物槽位 ${index + 1}`} draggable="true"
              on:dragstart={e => drag.start(e, list, index, slots ?? [])}
              on:dragover={e => { if (drag.over(e, list)) dropTarget = index; }}
              on:drop={e => drop(e, index)} on:dragend={() => { drag.clear(); dropTarget = null; }}>
              <SlotOrder {index} length={slots.length} kind="魔物" onMove={to => move(index, to)} />
              <div class="ot2-slot-controls">
              <SaveIdSelect value={slot.EnemyID} label={`魔物 ${index + 1}`} {options} currentLabel={monsterLabel(slot.EnemyID)} onSelect={id => patch(index, { EnemyID: id })} />
              <label>召唤次数 Count<input type="text" inputmode="numeric" aria-label={`魔物 ${index + 1} 召唤次数`} value={slot.Count} on:input={e => count(e, index)} on:blur={e => normalizeCount(e, index)} /></label>
              <div class="actions">
                <button type="button" disabled={!monsterCatalogue[slot.EnemyID]} on:click={() => patch(index, { Count: monsterCatalogue[slot.EnemyID].countMax })}>填入字典 countMax</button>
                <button type="button" on:click={() => apply(s => clearMonsterSlot(s, list, index))}>清空</button>
              </div>
              <details>
                <summary>高级设置</summary>
                <label class="used"><input type="checkbox" aria-label={`魔物 ${index + 1} Used`} checked={slot.Used} on:change={e => patch(index, { Used: e.currentTarget.checked })} />Used（战斗内已使用标记）</label>
              </details>
              </div>
              {#if monsterCatalogue[slot.EnemyID]}
                {@const description = describeMonsterSkills(monsterCatalogue[slot.EnemyID])}
                <div class="ot2-slot-details" data-slot-details="monster">
                  <p class="rank" aria-label={`强度 ${monsterCatalogue[slot.EnemyID].rank} 星`}>{"★".repeat(monsterCatalogue[slot.EnemyID].rank)}{"☆".repeat(10 - monsterCatalogue[slot.EnemyID].rank)} · {monsterCatalogue[slot.EnemyID].rank}/10</p>
                  {#each description.skills as skill}
                    <p class="skill-name">{skill.name}</p>
                    {#if skill.description}<p class="description">{skill.description}</p>{/if}
                  {/each}
                  {#if description.notes}<p class="description">{description.notes}</p>{/if}
                  {#if monsterCatalogue[slot.EnemyID].meatItem}<p class="meat">加工产物：{monsterCatalogue[slot.EnemyID].meatItem}</p>{/if}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      {/key}
    {:else}<p role="status">此列表缺少有效的 10 槽结构，已保留原始数据，编辑不可用。</p>{/if}
  </div>
</div>

<style lang="postcss">
  .captured-monsters { @apply min-w-0 space-y-4; max-width: 980px; }
  .tabs, .actions { @apply flex flex-wrap gap-2; }
  button { @apply rounded bg-primary-400 px-3 py-2 text-sm text-white; }
  button[aria-selected="true"] { @apply bg-primary-300; }
  button:disabled { @apply cursor-not-allowed opacity-40; }
  label { @apply flex min-w-0 flex-col gap-1 text-sm; }
  input[type="text"] { @apply w-full min-w-0 rounded px-2 py-2 text-primary-900; }
  .used { @apply mt-2 flex-row items-center gap-2; }
  [role="alert"] { @apply text-red-300; }
  summary { @apply cursor-pointer text-sm; }
</style>
