<script lang="ts">
  import { tick } from "svelte";
  import Int from "$lib/components/Items/Int.svelte";
  import type { ItemInt } from "$lib/types";
  import { itemLabel } from "../utils/item-details";
  import ItemDetails from "./ItemDetails.svelte";
  export let item: ItemInt;
  let preview: number | undefined;
  let open = false;
  let detailsEl: HTMLDivElement;
  async function reveal() {
    await tick();
    detailsEl?.scrollIntoView({ block: "start" });
  }
</script>

<div class="ot2-equipment-field">
  <Int {item} optionLabel={itemLabel} onPreview={id => { preview = Number(id); open = true; reveal(); }} let:value>
    <button class="current" type="button" on:click={() => { preview = undefined; open = !open; if (open) reveal(); }}>查看当前装备详情</button>
    {#if open}<div class="details-position" bind:this={detailsEl}><ItemDetails id={preview ?? Number(value)}><button type="button" on:click={() => open = false}>关闭详情</button></ItemDetails></div>{/if}
  </Int>
</div>

<style lang="postcss">
  .ot2-equipment-field { @apply min-w-0; max-width: 100%; }
  button { @apply mb-4 mr-4 rounded bg-primary-400 px-2 py-1 text-xs; }
  .current { @apply -mt-2; }
  .details-position { scroll-margin-top: 6rem; }
  .ot2-equipment-field :global(.ot2-details) { @apply mr-4; max-width: 440px; }
</style>
