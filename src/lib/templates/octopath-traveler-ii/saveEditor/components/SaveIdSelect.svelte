<script lang="ts">
  export let value: number;
  export let label: string;
  export let options: readonly { id: number; name: string }[];
  export let currentLabel: string;
  export let onSelect: (id: number) => void;
  let query = "";
  $: words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  $: visible = options.filter(o => words.every(w => `${o.id} ${o.name}`.toLocaleLowerCase().includes(w)));
  $: currentVisible = visible.some(o => o.id === value);
  $: pinnedLabel = currentLabel === `未知 (ID: ${value})` ? currentLabel : `${currentLabel} (ID: ${value})`;
</script>

<div class="id-select">
  <label>{label}搜索<input type="search" aria-label={`${label}搜索`} placeholder="中文名 / ID" bind:value={query} /></label>
  <label>{label}<select aria-label={label} {value} on:change={e => onSelect(Number(e.currentTarget.value))}>
    <option value={-1}>空槽 (ID: -1)</option>
    {#if value !== -1 && !currentVisible}<option value={value}>{pinnedLabel} · 当前值</option>{/if}
    {#each visible as option (option.id)}<option value={option.id}>{option.name} (ID: {option.id})</option>{/each}
  </select></label>
</div>

<style lang="postcss">
  .id-select { @apply grid min-w-0 gap-2; }
  label { @apply flex min-w-0 flex-col gap-1 text-sm; }
  input, select { @apply w-full min-w-0 rounded px-2 py-2 text-primary-900; max-width: 100%; }
</style>
