<script lang="ts">
  import { dataJson } from "$lib/stores";
  import { appendLearnedSlot, learnedAbilityCatalogue, learnedAbilityCostLabel, learnedAbilityLabel, learnedAbilityOptions, moveLearnedSlot, readBackupLearnAbilities, readLearnAbilityList, removeLearnedSlot, resizeLearnedSlots, restoreFromBackup, setLearnedAbility, syncToBackup } from "../utils/learned-abilities";
  import { editSave } from "../utils/save-feature-store";
  import type { SaveChange, SaveData } from "../utils/save-feature-state";
  import SaveIdSelect from "./SaveIdSelect.svelte";
  import SlotOrder from "./SlotOrder.svelte";
  import { createSlotDrag } from "../utils/slot-drag";
  import "./save-feature-rows.css";
  let error = "";
  const drag = createSlotDrag();
  let dropTarget: number | null = null;
  $: skills = readLearnAbilityList($dataJson);
  $: backup = readBackupLearnAbilities($dataJson);
  const describe = (id: number) => `${learnedAbilityLabel(id)} [${id}]`;
  function apply(action: (save: SaveData) => SaveChange) {
    try { editSave(action); error = ""; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  function remove(index: number) {
    if (skills && window.confirm(`删除槽位 ${index + 1}：${describe(skills[index])}？\n后续槽位将前移，剧情备份不变。`)) apply(s => removeLearnedSlot(s, index, true));
  }
  function resetFive() {
    if (!skills) return;
    const removed = skills.slice(5).map(describe).join("、");
    if (skills.length > 5 && !window.confirm(`恢复默认 5 槽将删除：${removed}\n确认继续？剧情备份不变。`)) return;
    apply(s => resizeLearnedSlots(s, 5, true));
  }
  function sync() {
    if (window.confirm("将当前技能覆盖到剧情备份？原剧情备份内容将被替换。")) apply(s => syncToBackup(s, true));
  }
  function restore() {
    if (window.confirm("从剧情备份恢复？当前技能及槽位数量将被替换，备份自身不变。")) apply(s => restoreFromBackup(s, true));
  }
  function move(from: number, to: number) { apply(s => moveLearnedSlot(s, from, to)); }
  function drop(event: DragEvent, to: number) {
    drag.drop(event, "learned", to, skills ?? [], move);
    dropTarget = null;
  }
</script>

<div class="learned-abilities" data-save-feature="learned">
  <p>光的习得技能。普通编辑不会修改剧情备份。</p>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if skills}
    <div class="toolbar">
      <strong>当前 {skills.length} 槽{skills.length > 5 ? " · 实验性" : ""}</strong>
      <button type="button" on:click={() => apply(appendLearnedSlot)}>添加槽位（实验性）</button>
      <button type="button" disabled={skills.length === 5} on:click={resetFive}>恢复默认 5 槽</button>
    </div>
    {#if skills.length > 5}<p class="note">扩容后的战斗菜单、习得/遗忘及再次保存行为尚待游戏内验证。</p>{/if}
    <div class="slots ot2-slot-rows" role="list" aria-label="习得技能槽位">
      {#each skills as id, index (index)}
        <section class="slot ot2-slot-row" class:drop-target={dropTarget === index} role="listitem" aria-label={`习得技能槽位 ${index + 1}`} draggable="true"
          on:dragstart={e => drag.start(e, "learned", index, skills ?? [])}
          on:dragover={e => { if (drag.over(e, "learned")) dropTarget = index; }}
          on:drop={e => drop(e, index)} on:dragend={() => { drag.clear(); dropTarget = null; }}>
          <SlotOrder {index} length={skills.length} kind="技能" onMove={to => move(index, to)} />
          <div class="ot2-slot-controls">
          <SaveIdSelect value={id} label={`技能 ${index + 1}`} options={learnedAbilityOptions} currentLabel={learnedAbilityLabel(id)} onSelect={value => apply(s => setLearnedAbility(s, index, value))} />
          <div class="actions">
            <button type="button" on:click={() => apply(s => setLearnedAbility(s, index, -1))}>清空槽位</button>
            <button type="button" disabled={skills.length <= 5} title="至少保留默认 5 槽；可清空槽位" on:click={() => remove(index)}>删除槽位</button>
          </div>
          </div>
          {#if learnedAbilityCatalogue[id]}
            <div class="ot2-slot-details" data-slot-details="learned">
              <span class="cost">{learnedAbilityCostLabel(learnedAbilityCatalogue[id])}</span>
              <p class="description">{learnedAbilityCatalogue[id].description}</p>
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {:else}<p role="status">存档缺少有效的 LearnAbilityList，已保留原始数据，编辑不可用。</p>{/if}
  <details class="backup">
    <summary>剧情备份管理（高级）</summary>
    {#if backup}
      <p>剧情备份共 {backup.length} 槽；仅通过下方确认操作修改。</p>
      <ol>{#each backup as id}<li>{describe(id)}</li>{/each}</ol>
    {:else}<p>没有有效的 BackupLearnAbility.Org_LearnAbility，备份操作不可用。</p>{/if}
    <div class="actions">
      <button type="button" disabled={!skills || !backup} on:click={sync}>同步当前技能到剧情备份</button>
      <button type="button" disabled={!skills || !backup} on:click={restore}>从备份恢复</button>
    </div>
  </details>
</div>

<style lang="postcss">
  .learned-abilities { @apply min-w-0 space-y-4; max-width: 980px; }
  .toolbar, .actions { @apply flex flex-wrap items-center gap-2; }
  button { @apply rounded bg-primary-400 px-3 py-2 text-sm text-white; }
  button:disabled { @apply cursor-not-allowed opacity-40; }
  [role="alert"] { @apply text-red-300; }
  .note { @apply text-sm text-amber-200; }
  .backup { @apply rounded border border-primary-400 p-3; }
  summary { @apply cursor-pointer; }
  ol { @apply my-3 list-inside list-decimal text-sm; overflow-wrap: anywhere; }
</style>
