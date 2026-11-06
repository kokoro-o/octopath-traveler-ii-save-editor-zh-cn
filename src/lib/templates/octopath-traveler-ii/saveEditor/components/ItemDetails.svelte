<script lang="ts">
  import { getItemDetails, itemCatalogue } from "../utils/item-details";
  import ItemCard from "./ItemCard.svelte";
  export let id: number;
  $: item = getItemDetails(id);
</script>

<section class="ot2-details" data-item-detail={id} aria-label="物品详情">
  {#if item}
    <ItemCard {item}>
      <slot />
      <details slot="source">
        <summary>来源与原始技术数据</summary>
        <p>Switch {itemCatalogue.source.version} · {item.rowName}</p>
        <p>名称：{item.nameRef}</p><p>说明：{item.descriptionRef}</p>
        <p>游戏分类：{item.gameCategory} / {item.equipmentCategory}</p>
        <pre>{JSON.stringify({ stats: item.stats, effects: item.effects, attributeResist: item.attributeResist, diseaseResist: item.diseaseResist, abilityRef: item.abilityRef, specialRef: item.specialRef, contexts: item.contexts, restrictions: item.restrictions }, null, 2)}</pre>
      </details>
    </ItemCard>
  {:else}
    <div class="empty"><p>{id === -1 || id === 0 ? "此栏位未装备物品" : `未收录物品 ID ${id}；保留原有存档值。`}</p><slot /></div>
  {/if}
</section>

<style lang="postcss">
  .ot2-details { @apply mb-4 min-w-0 text-sm; overflow-wrap: anywhere; }
  .empty { @apply flex items-start justify-between gap-3 rounded bg-primary-700 p-4; }
  details { @apply mt-4 text-xs; }
  summary { @apply cursor-pointer; }
  pre { @apply mt-2 max-h-64 overflow-auto whitespace-pre-wrap; }
</style>
