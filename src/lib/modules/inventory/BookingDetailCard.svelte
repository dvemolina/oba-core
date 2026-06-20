<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import AllocationBadge from '$lib/components/inventory/AllocationBadge.svelte';
	import type { ServiceModules } from '$lib/features/services/modules';
	import type { InventoryAllocationWithDetails, InventoryItem } from '$lib/features/inventory/types';

	// ── Local interfaces ──────────────────────────────────────────────────────

	interface ServiceInventoryLink {
		itemTypeId: string;
		itemType: {
			name: string;
			attributeSchema: Record<string, string[]>;
		};
	}

	interface Enrollment {
		id: string;
		status: string;
		participantCount?: number | null;
	}

	let {
		booking,
		modules,
		serviceInventoryLinks,
		itemsByAllocType,
		allocTypeTracking
	}: {
		booking: {
			id: string;
			date: string;
			dateEnd?: string | null;
			status: string;
			allocations: InventoryAllocationWithDetails[];
			clients: Enrollment[];
		};
		modules: ServiceModules;
		serviceInventoryLinks: ServiceInventoryLink[];
		itemsByAllocType: Record<string, InventoryItem[]>;
		allocTypeTracking: Record<string, 'pool' | 'specific'>;
	} = $props();

	// ── Derived state ─────────────────────────────────────────────────────────

	const totalParticipants = $derived(
		booking.clients
			.filter(c => c.status !== 'cancelled')
			.reduce((s, c) => s + (c.participantCount ?? 1), 0)
	);

	// ── Inventory state ───────────────────────────────────────────────────────

	let addingAlloc = $state(false);
	let addAllocTypeId = $state('');
	let addAllocQty = $state(1);
	$effect(() => { if (!addAllocTypeId && serviceInventoryLinks.length > 0) addAllocTypeId = serviceInventoryLinks[0].itemTypeId; });
	let addAllocSelectedGroup = $state<string | null>(null);
	let addFuzzy = $state(true);
	let reassigningAllocId = $state<string | null>(null);

	const missingLinks = $derived(
		serviceInventoryLinks.filter(l => !booking.allocations.some(a => a.itemTypeId === l.itemTypeId))
	);

	// Items available for the currently-selected add type
	const addAllocItems = $derived(
		addAllocTypeId ? (itemsByAllocType[addAllocTypeId] ?? []) : []
	);

	// ── Helpers ───────────────────────────────────────────────────────────────

	function groupInventoryItems(
		items: { id: string; name: string; attributes: Record<string, string>; status: string }[],
		attrEntries: [string, string[]][]
	) {
		type G = { label: string; attrs: Record<string, string>; available: number; total: number; items: typeof items };
		if (items.length === 0) return [] as G[];
		if (attrEntries.length === 0)
			return [{ label: '', attrs: {}, available: items.filter(i => i.status === 'available').length, total: items.length, items }];
		const map = new Map<string, G>();
		for (const item of items) {
			const label = attrEntries.map(([k]) => item.attributes[k]).filter(v => v?.trim()).join(' · ');
			const attrs = Object.fromEntries(attrEntries.map(([k]) => [k, item.attributes[k] ?? ''])) as Record<string, string>;
			if (!map.has(label)) map.set(label, { label, attrs, available: 0, total: 0, items: [] });
			const g = map.get(label)!;
			g.total++;
			g.items.push(item);
			if (item.status === 'available') g.available++;
		}
		return Array.from(map.values());
	}
</script>

{#if booking.allocations.length > 0 || serviceInventoryLinks.length > 0}
<div class="rounded-(--radius-card) overflow-hidden border border-orange-100 bg-white">
	<!-- Card header -->
	<div class="flex items-center justify-between bg-orange-50 px-4 py-2.5">
		<span class="text-xs font-semibold uppercase tracking-wide text-orange-700">
			🎒 Inventario · {totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}
		</span>
		{#if serviceInventoryLinks.length > 0 && booking.status !== 'cancelled'}
			<button
				type="button"
				onclick={() => {
					addingAlloc = !addingAlloc;
					addAllocTypeId = serviceInventoryLinks[0]?.itemTypeId ?? '';
					addAllocQty = 1;
					addAllocSelectedGroup = null;
					addFuzzy = true;
				}}
				class="text-xs text-orange-600 hover:underline"
			>
				{addingAlloc ? 'Cancelar' : '+ Asignar'}
			</button>
		{/if}
	</div>

	<!-- Add allocation form -->
	{#if addingAlloc}
	{@const addLink = serviceInventoryLinks.find(l => l.itemTypeId === addAllocTypeId)}
	{@const addAttrEntries = Object.entries(addLink?.itemType.attributeSchema ?? {})}
	{@const addGroups = groupInventoryItems(addAllocItems, addAttrEntries)}
	{@const addSelectedGroup = addGroups.find(g => g.label === addAllocSelectedGroup) ?? null}
	{@const availCount = (addSelectedGroup ? addSelectedGroup.items : addAllocItems).filter(i => i.status === 'available').length}
	<form
		method="POST"
		action="?/addAlloc"
		use:enhance={withToast(() => { addingAlloc = false; addAllocSelectedGroup = null; addAllocQty = 1; addFuzzy = true; })}
		class="border-b border-orange-100 bg-orange-50/40 p-4 space-y-3"
	>
		<!-- Type selector -->
		{#if serviceInventoryLinks.length > 1}
		<div>
			<label for="alloc-type-select" class="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
			<select
				id="alloc-type-select"
				name="itemTypeId"
				bind:value={addAllocTypeId}
				onchange={() => { addAllocSelectedGroup = null; addAllocQty = 1; addFuzzy = false; }}
				class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
			>
				{#each serviceInventoryLinks as link}
					<option value={link.itemTypeId}>{link.itemType.name}</option>
				{/each}
			</select>
		</div>
		{:else}
			<input type="hidden" name="itemTypeId" value={addAllocTypeId} />
			<p class="text-xs font-semibold text-gray-700">{addLink?.itemType.name}</p>
		{/if}

		{#if addAttrEntries.length > 0}
		<!-- Variant chips -->
		<div>
			<p class="mb-1.5 text-xs font-medium text-gray-600">Variante</p>
			<div class="flex flex-wrap gap-1.5">
				{#each addGroups as group}
				{@const isSelected = addAllocSelectedGroup === group.label && !addFuzzy}
				<button
					type="button"
					onclick={() => { addAllocSelectedGroup = isSelected ? null : group.label; addAllocQty = 1; addFuzzy = false; }}
					class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
						{group.available === 0 ? 'opacity-50' : ''}
						{isSelected ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
				>
					{group.label || '—'}
					<span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 font-normal">{group.available}</span>
				</button>
				{/each}
				<button
					type="button"
					onclick={() => { addFuzzy = !addFuzzy; addAllocSelectedGroup = null; addAllocQty = 1; }}
					class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
						{addFuzzy ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-dashed border-gray-300 bg-white text-gray-500 hover:border-gray-400'}"
				>
					Sin variante específica
				</button>
			</div>
			{#if addSelectedGroup && !addFuzzy}
				{#each Object.entries(addSelectedGroup.attrs) as [key, val]}
					{#if val}<input type="hidden" name="attrKey" value={key} /><input type="hidden" name="attrVal" value={val} />{/if}
				{/each}
			{/if}
			{#if addFuzzy}
				<input type="hidden" name="fuzzy" value="true" />
			{/if}
		</div>
		{/if}

		<!-- Quantity stepper — shown once variant selected, fuzzy chosen, or no variants -->
		{#if !addAttrEntries.length || addSelectedGroup || addFuzzy}
		<div class="flex items-center gap-3">
			<!-- svelte-ignore a11y_label_has_associated_control -->
		<label class="text-xs font-medium text-gray-600">Cantidad</label>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => addAllocQty = Math.max(1, addAllocQty - 1)}
					class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
				>−</button>
				<span class="w-6 text-center text-sm font-semibold">{addAllocQty}</span>
				<button
					type="button"
					onclick={() => addAllocQty = Math.min(availCount, addAllocQty + 1)}
					class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
				>+</button>
			</div>
			{#if availCount === 0 && !addFuzzy}
				<span class="text-xs text-red-500">Sin stock</span>
			{:else if addFuzzy}
				<span class="text-xs text-amber-600">⚠ Pendiente de asignar</span>
			{:else}
				<span class="text-xs text-muted">{availCount} disponibles</span>
			{/if}
		</div>
		<input type="hidden" name="quantity" value={addAllocQty} />
		<div class="flex gap-2">
			<button
				type="submit"
				disabled={addAllocQty < 1 || (availCount === 0 && !addFuzzy)}
				class="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40"
			>
				Añadir {addAllocQty}
			</button>
			<button
				type="button"
				onclick={() => { addingAlloc = false; addAllocSelectedGroup = null; addAllocQty = 1; addFuzzy = false; }}
				class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
			>Cancelar</button>
		</div>
		{/if}
	</form>
	{/if}

	<!-- Missing allocations banner: linked types with no allocation yet -->
	{#if missingLinks.length > 0 && booking.status !== 'cancelled'}
		<div class="border-b border-amber-100 bg-amber-50/70 px-4 py-2.5 space-y-1">
			{#each missingLinks as link}
				<div class="flex items-center gap-2">
					<span class="text-xs text-amber-700">
						⚠ {totalParticipants}× <strong>{link.itemType.name}</strong> pendiente de asignar
					</span>
					<button type="button"
						onclick={() => { addingAlloc = true; addAllocTypeId = link.itemTypeId; addAllocQty = totalParticipants; addAllocSelectedGroup = null; addFuzzy = true; }}
						class="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200">
						Asignar
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Existing allocations -->
	{#if booking.allocations.length > 0}
	<div class="flex flex-col gap-2 px-4 py-3">
		{#each booking.allocations as alloc}
			<div class="flex items-start gap-2">
				<div class="min-w-0 flex-1">
					<AllocationBadge
						allocation={alloc}
						onAssign={(id) => { reassigningAllocId = reassigningAllocId === id ? null : id; }}
					/>
					{#if reassigningAllocId === alloc.id}
						<form
							method="POST"
							action="?/reassignAllocItem"
							use:enhance={withToast()}
							class="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-2"
							onsubmit={() => { reassigningAllocId = null; }}
						>
							<input type="hidden" name="allocId" value={alloc.id} />
							<select name="itemId" class="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm">
								<option value="">— sin asignar —</option>
								{#each (itemsByAllocType[alloc.itemTypeId] ?? []) as item}
									<option value={item.id} selected={alloc.itemId === item.id}>{item.name}</option>
								{/each}
							</select>
							<button
								type="submit"
								class="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
							>
								Guardar
							</button>
						</form>
					{/if}
				</div>
				<form method="POST" action="?/removeAlloc" use:enhance={withToast()}>
					<input type="hidden" name="allocId" value={alloc.id} />
					<button
						type="submit"
						onclick={(e) => { if (!confirm('¿Eliminar esta asignación?')) e.preventDefault(); }}
						class="mt-2.5 shrink-0 rounded p-1 text-gray-400 hover:text-red-500"
					>✕</button>
				</form>
			</div>
		{/each}
	</div>
	{:else if !addingAlloc}
	<p class="px-4 py-4 text-sm text-gray-400">Sin elementos asignados.</p>
	{/if}
</div>
{/if}
