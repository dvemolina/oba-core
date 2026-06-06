<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Package, Plus, Trash2 } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Auto-open add form when freshly created type has 0 items
	let addingItem = $state(data.itemType.trackingMode === 'specific' && data.itemType.items.length === 0 && data.canEdit);

	// Bulk-add form state
	let selectedAttrs = $state<Record<string, string>>({});
	let itemCount = $state(1);

	// Auto-generate name from type name + selected attribute values
	let namePreview = $derived(
		[data.itemType.name, ...Object.values(selectedAttrs).filter(Boolean)].join(' ')
	);

	// Preview list of names that will be created
	let namesList = $derived(
		itemCount === 1
			? [namePreview]
			: Array.from({ length: Math.min(itemCount, 5) }, (_, i) => `${namePreview} #${i + 1}`)
			  .concat(itemCount > 5 ? [`… #${itemCount}`] : [])
	);

	const STATUS_OPTIONS = $derived([
		{ value: 'available', label: m.inventory_status_available() },
		{ value: 'maintenance', label: m.inventory_status_maintenance() },
		{ value: 'retired', label: m.inventory_status_retired() }
	]);

	const STATUS_COLORS: Record<string, string> = {
		available: 'bg-emerald-50 text-emerald-700',
		maintenance: 'bg-amber-50 text-amber-700',
		retired: 'bg-gray-100 text-gray-500'
	};

	let attrEntries = $derived(Object.entries(data.itemType.attributeSchema));
	let managingItems = $state(false);

	function statusLabel(status: string): string {
		return STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;
	}

	// Group items by their attribute combination for the chip view
	type ItemGroup = { label: string; available: number; maintenance: number; retired: number; total: number; items: typeof data.itemType.items };

	let itemGroups = $derived((): ItemGroup[] => {
		const items = data.itemType.items;
		if (items.length === 0) return [];
		if (attrEntries.length === 0) {
			const g = { label: data.itemType.name, available: 0, maintenance: 0, retired: 0, total: items.length, items };
			for (const i of items) { if (i.status === 'available') g.available++; else if (i.status === 'maintenance') g.maintenance++; else g.retired++; }
			return [g];
		}
		const map = new Map<string, ItemGroup>();
		for (const item of items) {
			const label = attrEntries.map(([k]) => item.attributes[k] ?? '—').join(' / ');
			if (!map.has(label)) map.set(label, { label, available: 0, maintenance: 0, retired: 0, total: 0, items: [] });
			const g = map.get(label)!;
			g.total++;
			g.items.push(item);
			if (item.status === 'available') g.available++;
			else if (item.status === 'maintenance') g.maintenance++;
			else g.retired++;
		}
		return Array.from(map.values());
	});
</script>

<div class="mx-auto max-w-2xl p-4 md:p-6">
	<div class="mb-6">
		<a href="/inventory" class="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
			<ArrowLeft size={14} /> {m.inventory_back()}
		</a>
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-900">{data.itemType.name}</h1>
			{#if !data.itemType.active}
				<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{m.inventory_badge_inactive()}</span>
			{/if}
		</div>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}
	{#if form?.message}
		<div class="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{form.message}</div>
	{/if}

	{#if data.canEdit}
	<form method="POST" action="?/update" use:enhance class="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
		<div class="grid grid-cols-2 gap-4">
			<div class="col-span-2">
				<label class="mb-1 block text-sm font-medium text-gray-700" for="name">{m.inventory_field_name()} *</label>
				<input id="name" name="name" type="text" required value={data.itemType.name}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
			<div class="col-span-2">
				<label class="mb-1 block text-sm font-medium text-gray-700" for="description">{m.inventory_field_description()}</label>
				<textarea id="description" name="description" rows="2"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">{data.itemType.description ?? ''}</textarea>
			</div>
			{#if data.itemType.trackingMode === 'pool'}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="totalPoolSize">{m.inventory_field_pool_size()}</label>
				<input id="totalPoolSize" name="totalPoolSize" type="number" min="1"
					value={data.itemType.totalPoolSize ?? ''}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
			{/if}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="capacity">{m.inventory_field_capacity()} <span class="font-normal text-gray-400">({m.inventory_field_capacity_hint()})</span></label>
				<input id="capacity" name="capacity" type="number" min="1"
					placeholder="—"
					value={data.itemType.capacity ?? ''}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
		</div>

		{#if attrEntries.length > 0}
		<div>
			<p class="mb-2 text-sm font-medium text-gray-700">{m.inventory_field_attributes()}</p>
			{#each attrEntries as [key, values]}
				<div class="mb-2 flex items-start gap-2">
					<input type="text" name="attributeKey" value={key}
						class="w-32 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
					<input type="text" name="attributeValues" value={values.join(', ')}
						class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
				</div>
			{/each}
		</div>
		{/if}

		<div class="flex justify-end">
			<button type="submit" class="rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean/90">
				{m.inventory_detail_save()}
			</button>
		</div>
	</form>
	{/if}

	{#if data.itemType.trackingMode === 'specific'}
	<div class="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-gray-100 p-4">
			<h2 class="font-semibold text-gray-900">{m.inventory_detail_physical_items()} ({data.itemType.items.length})</h2>
			{#if data.canEdit}
			<button onclick={() => (addingItem = !addingItem)}
				class="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50">
				<Plus size={14} /> {m.inventory_btn_add_item()}
			</button>
			{/if}
		</div>

		{#if addingItem && data.canEdit}
		<form
			method="POST"
			action="?/bulkAddItems"
			use:enhance={() => {
				return ({ update }) => {
					selectedAttrs = {};
					itemCount = 1;
					addingItem = false;
					update();
				};
			}}
			class="border-b border-gray-100 bg-gray-50 p-4 space-y-4"
		>
			<!-- Attribute pickers → drive name preview -->
			{#if attrEntries.length > 0}
			<div class="flex flex-wrap gap-3">
				{#each attrEntries as [key, values]}
				<div>
					<label class="mb-1 block text-xs font-medium text-gray-600 capitalize">{key}</label>
					<select
						name="attr_{key}"
						bind:value={selectedAttrs[key]}
						class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					>
						<option value="">—</option>
						{#each values as v}<option value={v}>{v}</option>{/each}
					</select>
				</div>
				{/each}
			</div>
			{/if}

			<!-- Name + count row -->
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-48 flex-1">
					<label class="mb-1 block text-xs font-medium text-gray-600">{m.inventory_item_name_label()} *</label>
					<input
						name="baseName"
						type="text"
						required
						value={namePreview}
						placeholder={m.inventory_item_name_placeholder()}
						class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-gray-600">{m.inventory_item_count_label()}</label>
					<input
						name="count"
						type="number"
						min="1"
						max="100"
						bind:value={itemCount}
						class="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					/>
				</div>
				<button type="submit" class="rounded-lg bg-ocean px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean/90">
					{m.inventory_btn_add()}
				</button>
				{#if data.itemType.items.length > 0}
				<button type="button" onclick={() => (addingItem = false)}
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
					{m.common_cancel()}
				</button>
				{/if}
			</div>

			<!-- Name preview -->
			{#if namePreview}
			<div class="rounded-lg bg-white border border-gray-200 px-3 py-2">
				<p class="mb-1 text-xs font-medium text-gray-500">{m.inventory_item_name_preview()}</p>
				<ul class="space-y-0.5">
					{#each namesList as name}
						<li class="text-sm text-gray-800">{name}</li>
					{/each}
				</ul>
				{#if itemCount > 1}
				<p class="mt-1 text-xs text-gray-400">{m.inventory_item_bulk_hint()}</p>
				{/if}
			</div>
			{/if}

			{#if form?.itemError}<p class="text-xs text-red-600">{form.itemError}</p>{/if}
		</form>
		{/if}

		{#if data.itemType.items.length === 0 && !addingItem}
			<div class="flex flex-col items-center gap-2 p-6 text-center">
				<p class="text-sm font-medium text-gray-500">{m.inventory_items_empty()}</p>
				<p class="text-xs text-gray-400">{m.inventory_items_empty_cta()}</p>
				{#if data.canEdit}
				<button
					onclick={() => (addingItem = true)}
					class="mt-1 flex items-center gap-1 rounded-lg bg-ocean px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean/90"
				>
					<Plus size={14} /> {m.inventory_btn_add_item()}
				</button>
				{/if}
			</div>
		{:else if data.itemType.items.length > 0}
			<!-- ── Chip overview ── -->
			<div class="flex flex-wrap gap-2 p-4">
				{#each itemGroups() as group}
				<div class="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-xs">
					{#if group.label && group.label !== data.itemType.name}
					<span class="text-sm font-medium text-gray-800">{group.label}</span>
					{/if}
					<!-- available count -->
					<span class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
						{group.available}
					</span>
					{#if group.maintenance > 0}
					<span class="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
						{group.maintenance}
					</span>
					{/if}
					{#if group.retired > 0}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
						{group.retired}
					</span>
					{/if}
				</div>
				{/each}
				<!-- legend -->
				<div class="flex items-center gap-3 pl-1 text-xs text-gray-400">
					<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-400"></span> {m.inventory_status_available()}</span>
					<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-400"></span> {m.inventory_status_maintenance()}</span>
					<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-gray-300"></span> {m.inventory_status_retired()}</span>
				</div>
			</div>

			<!-- ── Manage individual items (collapsible) ── -->
			{#if data.canEdit}
			<div class="border-t border-gray-100">
				<button
					onclick={() => (managingItems = !managingItems)}
					class="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700"
				>
					<span>Manage individual items</span>
					<span class="text-gray-400">{managingItems ? '▲' : '▼'}</span>
				</button>
				{#if managingItems}
				<ul class="divide-y divide-gray-100">
				{#each data.itemType.items as item}
					<li class="flex items-center justify-between gap-3 px-4 py-2">
						<p class="min-w-0 flex-1 truncate text-sm text-gray-800">{item.name}</p>
						<div class="flex shrink-0 items-center gap-2">
							<form method="POST" action="?/updateItemStatus" use:enhance>
								<input type="hidden" name="itemId" value={item.id} />
								<select name="status"
									onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
									class="rounded-lg border border-gray-300 px-2 py-1 text-xs {STATUS_COLORS[item.status] ?? ''}">
									{#each STATUS_OPTIONS as opt}
										<option value={opt.value} selected={item.status === opt.value}>{opt.label}</option>
									{/each}
								</select>
							</form>
							<form method="POST" action="?/deleteItem" use:enhance>
								<input type="hidden" name="itemId" value={item.id} />
								<button type="submit"
									onclick={(e) => { if (!confirm(m.inventory_confirm_delete_item())) e.preventDefault(); }}
									class="rounded p-1 text-gray-400 hover:text-red-500">
									<Trash2 size={14} />
								</button>
							</form>
						</div>
					</li>
				{/each}
				</ul>
				{/if}
			</div>
			{/if}
		{/if}
	</div>
	{:else}
	<div class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 font-semibold text-gray-900">{m.inventory_pool_summary()}</h2>
		<div class="flex items-center gap-6 text-sm">
			<div>
				<p class="text-gray-500">{m.inventory_pool_total()}</p>
				<p class="text-2xl font-bold text-gray-900">{data.itemType.totalPoolSize ?? '—'}</p>
			</div>
		</div>
		<p class="mt-3 text-xs text-gray-400">{m.inventory_pool_availability_hint()}</p>
	</div>
	{/if}

	{#if data.canEdit}
	<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-gray-900">{m.inventory_section_actions()}</h2>
		<div class="flex flex-wrap gap-2">
			<form method="POST" action="?/toggle" use:enhance>
				<button type="submit" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
					{data.itemType.active ? m.inventory_btn_deactivate() : m.inventory_btn_activate()}
				</button>
			</form>
			<form method="POST" action="?/delete" use:enhance>
				<button type="submit"
					onclick={(e) => { if (!confirm(m.inventory_confirm_delete_type())) e.preventDefault(); }}
					class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
					{m.inventory_btn_delete_type()}
				</button>
			</form>
		</div>
	</div>
	{/if}
</div>
