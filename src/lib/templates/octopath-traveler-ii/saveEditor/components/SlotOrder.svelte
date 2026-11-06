<script lang="ts">
  export let index: number;
  export let length: number;
  export let kind: string;
  export let onMove: (to: number) => void;
</script>

<div class="slot-order">
  <strong>槽位 {index + 1}</strong>
  <button type="button" draggable="true" data-drag-handle aria-label={`拖拽${kind}槽位 ${index + 1}`} title="拖拽排序，也可使用上下移按钮">⠿</button>
  <div class="arrows">
    <button type="button" aria-label={`上移${kind}槽位 ${index + 1}`} disabled={index === 0} on:click={() => onMove(index - 1)}>↑</button>
    <button type="button" aria-label={`下移${kind}槽位 ${index + 1}`} disabled={index === length - 1} on:click={() => onMove(index + 1)}>↓</button>
  </div>
</div>

<style lang="postcss">
  .slot-order { @apply flex flex-col items-center gap-2 text-sm; grid-area: order; }
  strong { @apply whitespace-nowrap; }
  button { @apply rounded bg-primary-400 px-3 py-2 text-white; min-width: 36px; }
  button:disabled { @apply cursor-not-allowed opacity-40; }
  [data-drag-handle] { cursor: grab; font-size: 1.5rem; line-height: 1; }
  [data-drag-handle]:active { cursor: grabbing; }
  .arrows { @apply flex flex-col gap-2; }
</style>
