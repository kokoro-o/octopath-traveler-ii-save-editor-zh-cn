<script lang="ts">
  import Int from "$lib/components/Items/Int.svelte";
  import type { ItemInt } from "$lib/types";
  import { categoryNames, type ItemDetails } from "../utils/item-details";
  import { itemEffectBadges, nonzeroStats } from "../utils/item-badges";

  export let item: ItemDetails;
  export let field: ItemInt | undefined = undefined;
  $: quantityField = field ? { ...field, name: "" } : undefined;
  $: stats = nonzeroStats(item);
  $: effects = itemEffectBadges(item);
</script>

<article class="item-card" data-item-id={item.id} aria-label={item.zhCN}>
  <div class="card-heading">
    <div class="name"><h3>{item.zhCN}</h3><p class="english">{item.en}</p></div>
    {#if quantityField}<div class="quantity" aria-label={`${item.zhCN}数量`}><span class="quantity-label">数量</span><Int item={quantityField} preserveDraft /></div>{:else}<slot />{/if}
  </div>
  <p class="category">{categoryNames[item.editorCategory]}</p>
  {#if stats.length || effects.length}
    <div class="stat-badges" aria-label="属性与效果">
      {#each stats as stat}<span class="stat-badge equipment-stat" class:positive={stat.value > 0} class:negative={stat.value < 0}>{stat.label} {stat.value > 0 ? "+" : ""}{stat.value}</span>{/each}
      {#each effects as badge}<span class="stat-badge" class:recovery={badge.tone === "recovery"} class:raw={badge.tone === "raw"} class:damage={badge.tone === "damage"} class:status={badge.tone === "status"} class:mixing={badge.tone === "mixing"} title={badge.title}>{badge.label}</span>{/each}
    </div>
  {/if}
  {#if item.description}<p class="official">{item.description}</p>{/if}
  <slot name="source" />
</article>

<style lang="postcss">
  .item-card { @apply min-w-0 rounded border border-primary-400 bg-primary-700 p-4 text-sm text-gray-200; }
  .card-heading { @apply flex items-start justify-between gap-3; }
  .name { @apply min-w-0; overflow-wrap: anywhere; }
  h3 { @apply font-bold text-white; line-height: 1.5; }
  .english { @apply mt-1 text-xs text-gray-400; }
  .quantity { @apply shrink-0; width: 60px; }
  .quantity-label { @apply mb-1 block text-center text-xs text-gray-400; }
  .quantity :global(.gtc-input) { margin: 0; padding: 0; width: 60px; background: transparent; }
  .quantity :global(input) { width: 60px; max-width: 60px; text-align: center; border-radius: 0.25rem; }
  .category { @apply mb-3 mt-2 text-xs text-gray-400; }
  .stat-badges { @apply mb-3 flex flex-wrap gap-2; }
  .stat-badge { @apply rounded-full border px-2 py-1 text-xs font-bold; }
  .positive { @apply border-green-800 bg-green-950 text-green-300; }
  .negative { @apply border-red-800 bg-red-950 text-red-300; }
  .recovery { @apply border-emerald-800 bg-emerald-950 text-emerald-300; }
  .raw { @apply border-violet-800 bg-violet-950 text-violet-200; }
  .damage { @apply border-orange-800 bg-orange-950 text-orange-200; }
  .status { @apply border-amber-800 bg-amber-950 text-amber-200; }
  .mixing { @apply border-cyan-800 bg-cyan-950 text-cyan-200; }
  .official { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
</style>
