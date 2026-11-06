<script lang="ts">
  import type { ItemInt } from "$lib/types";
  import { allItems, categoryNames, matchesItem, statLabels } from "../utils/item-details";
  import ItemCard from "./ItemCard.svelte";

  let query = "";
  let category = 0;
  let stat = "";
  let effectOnly = false;
  function search() { category = -1; }
  function clear() { query = ""; category = 0; stat = ""; effectOnly = false; }
  function categoryKey(event: KeyboardEvent) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const order = [-1, ...categoryNames.map((_, index) => index)];
    const next = Math.max(0, Math.min(order.length - 1, order.indexOf(category) + (forward ? 1 : -1)));
    category = order[next];
    const nav = (event.currentTarget as HTMLElement).parentElement!;
    nav.querySelectorAll("button")[next]?.focus();
  }
  $: visible = allItems.filter(item => matchesItem(item, query, category, stat, effectOnly));
  const fields = new Map(allItems.map(item => [item.id, {
    id: `inventory-${item.id}`, name: `${item.zhCN}（${item.en}）`, offset: 0,
    type: "variable", dataType: "uint32", min: 0, max: 99,
  } as ItemInt]));
  const fieldFor = (id: number) => fields.get(id)!;
</script>

<div class="ot2-inventory">
  <div class="toolbar">
    <label>搜索物品<input aria-label="搜索物品" placeholder="中文 / English / 类别 / 说明或效果" bind:value={query} on:input={search} /></label>
    <label>装备属性<select aria-label="装备属性筛选" bind:value={stat}><option value="">全部属性</option>{#each Object.entries(statLabels) as [key, label]}<option value={key}>{label}（非零）</option>{/each}</select></label>
    <label class="effect-filter"><input type="checkbox" bind:checked={effectOnly} />有效果或抗性记录</label>
    <button type="button" on:click={clear}>清除搜索与筛选</button>
    <span aria-live="polite">{visible.length} / 956 项</span>
  </div>
  <div class="browser">
    <nav aria-label="物品分类"><button type="button" aria-pressed={category === -1} class:active={category === -1} on:keydown={categoryKey} on:click={() => category = -1}>全部分类</button>
      {#each categoryNames as name, index}<button type="button" aria-pressed={category === index} class:active={category === index} on:keydown={categoryKey} on:click={() => category = index}>{name}</button>{/each}
    </nav>
    <div class="content">
      <div class="rows">
        {#each visible as item (item.id)}
          <ItemCard {item} field={fieldFor(item.id)} />
        {/each}
      </div>
      {#if !visible.length}<p>没有符合条件的物品。</p>{/if}
    </div>
  </div>
</div>

<style lang="postcss">
  .ot2-inventory { @apply min-w-0 flex-1; }
  .toolbar { @apply mb-4 flex flex-wrap items-end gap-3; }
  label { @apply flex min-w-0 flex-col gap-2 text-sm; }
  input:not([type="checkbox"]) { @apply max-w-full; width: 360px; }
  .effect-filter { @apply flex-row items-center py-2; }
  button { @apply rounded bg-primary-400 px-3 py-2 text-sm text-gray-200; }
  button:hover { @apply bg-primary-300; }
  .browser { @apply flex flex-col gap-4 md:flex-row; }
  nav { @apply flex flex-wrap content-start rounded bg-primary-700 md:w-36 md:shrink-0 md:flex-col md:self-start; }
  nav button { @apply rounded-none bg-transparent text-left; }
  nav button.active { @apply rounded bg-primary-300 text-white; }
  .content { @apply min-w-0 flex-1; }
  .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1rem; align-items: start; }
</style>
