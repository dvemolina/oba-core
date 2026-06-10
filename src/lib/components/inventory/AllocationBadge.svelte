<!-- src/lib/components/inventory/AllocationBadge.svelte -->
<script lang="ts">
	import type { InventoryAllocationWithDetails } from '$lib/features/inventory/types';

	let {
		allocation,
		onAssign
	}: {
		allocation: InventoryAllocationWithDetails;
		onAssign?: (allocId: string) => void;
	} = $props();

	const isFuzzy = $derived(allocation.itemId === null);
</script>

<div
	class="flex items-center gap-2 rounded-lg border px-3 py-2.5
	{isFuzzy ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100 bg-white'}"
>
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-gray-900">
			{allocation.quantity}× {allocation.itemTypeName}
		</p>
		{#if isFuzzy}
			<p class="text-xs text-amber-600">⚠ Pendiente de asignar</p>
		{:else if allocation.itemName}
			<p class="text-xs text-gray-500">{allocation.itemName}</p>
		{:else if allocation.attributeFilter && Object.keys(allocation.attributeFilter).length > 0}
			<div class="mt-0.5 flex flex-wrap gap-1">
				{#each Object.values(allocation.attributeFilter) as v}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{v}</span>
				{/each}
			</div>
		{/if}
	</div>
	{#if isFuzzy && onAssign}
		<button
			type="button"
			onclick={() => onAssign(allocation.id)}
			class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-200"
		>
			Asignar
		</button>
	{/if}
</div>
