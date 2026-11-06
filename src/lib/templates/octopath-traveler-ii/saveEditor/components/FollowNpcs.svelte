<script lang="ts">
  import { dataJson } from "$lib/stores";
  import { canEditFollowSlot, clearFollowNpcSlot, followCommandLabel, followNpcCatalogue, followNpcLabel, followNpcOptions, followOwners, moveFollowNpcSlot, readCharacterFollowNpcs, readFollowNpcList, setFollowNpc, setFollowSupportLimit, type FollowListKey } from "../utils/follow-npcs";
  import { editSave } from "../utils/save-feature-store";
  import type { SaveChange, SaveData } from "../utils/save-feature-state";
  import { createSlotDrag } from "../utils/slot-drag";
  import SaveIdSelect from "./SaveIdSelect.svelte";
  import SlotOrder from "./SlotOrder.svelte";
  import "./save-feature-rows.css";
  export let characterId: number;
  let list: FollowListKey = "FollowNpcSaveData";
  let error = "";
  const drag = createSlotDrag();
  let dropTarget: number | null = null;
  $: owner = followOwners[characterId];
  $: slots = readFollowNpcList($dataJson, list);
  $: owned = readCharacterFollowNpcs($dataJson, characterId);
  function apply(action: (save: SaveData) => SaveChange) {
    try { editSave(action); error = ""; } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  function selectList(next: FollowListKey) { drag.clear(); dropTarget = null; list = next; error = ""; }
  function move(from: number, to: number) { apply(s => moveFollowNpcSlot(s, list, from, to)); }
  function drop(event: DragEvent, to: number) { drag.drop(event, list, to, slots ?? [], move); dropTarget = null; }
  function normalizeCount(event: FocusEvent, index: number) {
    const value = readFollowNpcList($dataJson, list)?.[index].SupportLimit;
    if (value !== undefined) (event.currentTarget as HTMLInputElement).value = String(value);
  }
</script>

<div class="follow-npcs" data-save-feature="follow-npcs">
  <p>{owner?.name ?? `角色 ${characterId}`}的随行伙伴。下列各 4 槽为全队共享；其他角色的记录只读，请到对应角色页签编辑。</p>
  <p class="note">整条调序会保留归属与指令；填入空槽时才指定为本角色。手动次数范围为 1～2147483647，原有特殊值不会自动改写。</p>
  <div class="tabs" role="tablist" aria-label="随行 NPC 列表">
    <button type="button" role="tab" id="current-follow-tab" aria-selected={list === "FollowNpcSaveData"} aria-controls="follow-slots-panel" on:click={() => selectList("FollowNpcSaveData")}>当前随行 (4 槽)</button>
    <button type="button" role="tab" id="waiting-follow-tab" aria-selected={list === "FollowWaitingNpcSaveData"} aria-controls="follow-slots-panel" on:click={() => selectList("FollowWaitingNpcSaveData")}>待命 (4 槽)</button>
  </div>
  <p>本角色记录：{(list === "FollowNpcSaveData" ? owned.current : owned.waiting)?.length ?? 0} 条</p>
  {#if error}<p role="alert">{error}</p>{/if}
  <div id="follow-slots-panel" role="tabpanel" aria-labelledby={list === "FollowNpcSaveData" ? "current-follow-tab" : "waiting-follow-tab"}>
    {#if slots && owner}
      {#key `${characterId}:${list}`}
        <div class="ot2-slot-rows" role="list" aria-label="共享随行槽位">
          {#each slots as slot, index (index)}
            <section class="slot ot2-slot-row" class:drop-target={dropTarget === index} class:without-details={slot.NpcUniqueID === -1 || !followNpcCatalogue[slot.NpcUniqueID]} role="listitem" aria-label={`随行 NPC 槽位 ${index + 1}`} draggable="true"
              on:dragstart={e => drag.start(e, list, index, slots ?? [])}
              on:dragover={e => { if (drag.over(e, list)) dropTarget = index; }}
              on:drop={e => drop(e, index)} on:dragend={() => { drag.clear(); dropTarget = null; }}>
              <SlotOrder {index} length={4} kind="随行 NPC" onMove={to => move(index, to)} />
              <div class="ot2-slot-controls">
                <p class="ownership">{slot.NpcUniqueID === -1 ? `空槽（填入后归属：${owner.name}）` : `归属：${followOwners[slot.MasterCharacterID]?.name ?? `角色 ${slot.MasterCharacterID}`} (${slot.MasterCharacterID})`}</p>
                {#if slot.NpcUniqueID !== -1}<p class="note">随行指令：{followCommandLabel(slot.FieldCommandType)}{slot.MasterCharacterID !== characterId ? " · 请切换所属角色编辑" : ""}</p>{/if}
                <fieldset disabled={!canEditFollowSlot(slot, characterId)}>
                  <SaveIdSelect value={slot.NpcUniqueID} label={`随行 NPC ${index + 1}`} options={followNpcOptions} currentLabel={followNpcLabel(slot.NpcUniqueID)} onSelect={id => apply(s => setFollowNpc(s, list, index, id, characterId))} />
                  <label>剩余召唤次数<input type="text" inputmode="numeric" aria-label={`随行 NPC ${index + 1} 召唤次数`} value={slot.SupportLimit} disabled={slot.NpcUniqueID === -1} on:input={e => apply(s => setFollowSupportLimit(s, list, index, e.currentTarget.value, characterId))} on:blur={e => normalizeCount(e, index)} /></label>
                  <div class="actions">
                    <button type="button" disabled={slot.NpcUniqueID === -1} on:click={() => apply(s => setFollowSupportLimit(s, list, index, 99, characterId))}>99</button>
                    <button type="button" disabled={slot.NpcUniqueID === -1} on:click={() => apply(s => setFollowSupportLimit(s, list, index, 999, characterId))}>999</button>
                    <button type="button" on:click={() => apply(s => clearFollowNpcSlot(s, list, index, characterId))}>清空</button>
                  </div>
                </fieldset>
              </div>
              {#if slot.NpcUniqueID !== -1 && followNpcCatalogue[slot.NpcUniqueID]}
                {@const npc = followNpcCatalogue[slot.NpcUniqueID]}
                <div class="ot2-slot-details" data-slot-details="follow-npc">
                  <p class="skill-name">{npc.name}</p>
                  {#if npc.rank !== null}<p class="rank" aria-label={`强度 ${npc.rank} 星`}>强度：{"★".repeat(npc.rank)}{"☆".repeat(10 - npc.rank)} ({npc.rank}星)</p>{/if}
                  <p class="description">所在区域：{npc.town}</p>
                  <p>数据库次数：{npc.defaultSupportLimit ?? "多个版本，需手动设置"}{npc.unlimited ? "；无限支援标记：是" : ""}</p>
                  {#if npc.skills.length}
                    <p class="skill-name">支援技能</p>
                    {#each npc.skills as skill (skill.abilityRef)}
                      <p class="skill-name">{skill.name}{skill.descriptionSource === "database" ? " · 效果摘要" : ""}</p>
                      <p class="description">{skill.description}</p>
                    {/each}
                    {#if npc.skills.some(skill => skill.descriptionSource === "database")}<p class="note skill-note">效果摘要依据数据库配置整理；招式段数及特殊机制以游戏内为准。</p>{/if}
                  {/if}
                </div>
              {/if}
            </section>
          {/each}
        </div>
      {/key}
    {:else}<p role="status">此列表缺少有效的共享 4 槽结构或角色映射，已保留原始数据，编辑不可用。</p>{/if}
  </div>
</div>

<style lang="postcss">
  .follow-npcs { @apply min-w-0 space-y-4; max-width: 980px; }
  .tabs, .actions { @apply flex flex-wrap gap-2; }
  button { @apply rounded bg-primary-400 px-3 py-2 text-sm text-white; }
  button[aria-selected="true"] { @apply bg-primary-300; }
  button:disabled { @apply cursor-not-allowed opacity-40; }
  fieldset { @apply min-w-0 space-y-3; }
  fieldset:disabled { @apply opacity-60; }
  label { @apply flex min-w-0 flex-col gap-1 text-sm; }
  input { @apply w-full min-w-0 rounded px-2 py-2 text-primary-900; }
  .ownership { @apply text-sm font-bold; }
  .note { @apply text-sm text-slate-300; }
  .skill-note { @apply mt-3; }
  .without-details { grid-template-areas: "order editor"; grid-template-columns: 66px minmax(220px, 300px); }
  @media (max-width: 1100px) { .without-details { grid-template-columns: 58px minmax(0, 1fr); } }
  @media (max-width: 480px) { .without-details { grid-template-columns: 52px minmax(0, 1fr); } }
  [role="alert"] { @apply text-red-300; }
</style>
