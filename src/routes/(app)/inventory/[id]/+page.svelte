<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Package, Plus, Trash2 } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let addingItem = $state(false);

	const PRICING_OPTIONS = [
		{ value: 'per_hour', label: 'Per hour' },
		{ value: 'per_half_day', label: 'Per half-day' },
		{ value: 'per_day', label: 'Per day' },
		{ value: 'per_night', label: 'Per night' },
		{ value: 'per_session', label: 'Per session' },
		{ value: 'flat', label: 'Flat fee' }
	];

	const STATUS_LABELS: Record<string, string> = {
		available: 'Available',
		maintenance: 'Maintenance',
		retired: 'Retired'
	};

	const STATUS_COLORS: Record<string, string> = {
		available: 'bg-emerald-50 text-emerald-700',
		maintenance: 'bg-amber-50 text-amber-700',
		retired: 'bg-gray-100 text-gray-500'
	};

	let attrEntries = $derived(Object.entries(data.itemType.attributeSchema));
</script>

<div class="mx-auto max-w-2xl p-4 md:p-6">
	<div class="mb-6">
		<a href="/inventory" class="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
			<ArrowLeft size={14} /> Back to inventory
		</a>
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-900">{data.itemType.name}</h1>
			{#if !data.itemType.active}
				<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
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
				<label class="mb-1 block text-sm font-medium text-gray-700" for="name">Name *</label>
				<input id="name" name="name" type="text" required value={data.itemType.name}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
			<div class="col-span-2">
				<label class="mb-1 block text-sm font-medium text-gray-700" for="description">Description</label>
				<textarea id="description" name="description" rows="2"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">{data.itemType.description ?? ''}</textarea>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="unitPrice">Price *</label>
				<input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required
					value={parseFloat(data.itemType.unitPrice).toFixed(2)}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="pricingUnit">Pricing unit</label>
				<select id="pricingUnit" name="pricingUnit"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
					{#each PRICING_OPTIONS as opt}
						<option value={opt.value} selected={data.itemType.pricingUnit === opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			{#if data.itemType.trackingMode === 'pool'}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="totalPoolSize">Pool size</label>
				<input id="totalPoolSize" name="totalPoolSize" type="number" min="1"
					value={data.itemType.totalPoolSize ?? ''}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
			{/if}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="capacity">Capacity per unit <span class="font-normal text-gray-400">(optional)</span></label>
				<input id="capacity" name="capacity" type="number" min="1" placeholder="—"
					value={data.itemType.capacity ?? ''}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
			</div>
		</div>

		{#if attrEntries.length > 0}
		<div>
			<p class="mb-2 text-sm font-medium text-gray-700">Attributes</p>
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
				Save changes
			</button>
		</div>
	</form>
	{/if}

	{#if data.itemType.trackingMode === 'specific'}
	<div class="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-gray-100 p-4">
			<h2 class="font-semibold text-gray-900">Physical items ({data.itemType.items.length})</h2>
			{#if data.canEdit}
			<button onclick={() => (addingItem = !addingItem)}
				class="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50">
				<Plus size={14} /> Add item
			</button>
			{/if}
		</div>

		{#if addingItem && data.canEdit}
		<form method="POST" action="?/addItem" use:enhance={() => { return ({ update }) => { addingItem = false; update(); }; }}
			class="border-b border-gray-100 bg-gray-50 p-4">
			<div class="flex flex-wrap items-end gap-3">
				<div class="min-w-[140px] flex-1">
					<label class="mb-1 block text-xs font-medium text-gray-600">Item name *</label>
					<input name="name" type="text" required placeholder="e.g. Wetsuit M-01"
						class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
				</div>
				{#each attrEntries as [key, values]}
				<div>
					<label class="mb-1 block text-xs font-medium text-gray-600 capitalize">{key}</label>
					<select name="attr_{key}"
						class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
						<option value="">—</option>
						{#each values as v}<option value={v}>{v}</option>{/each}
					</select>
				</div>
				{/each}
				<button type="submit"
					class="rounded-lg bg-ocean px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean/90">Add</button>
				<button type="button" onclick={() => (addingItem = false)}
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
			</div>
			{#if form?.itemError}<p class="mt-2 text-xs text-red-600">{form.itemError}</p>{/if}
		</form>
		{/if}

		{#if data.itemType.items.length === 0}
			<div class="p-6 text-center text-sm text-gray-400">No items yet. Add physical items above.</div>
		{:else}
			<ul class="divide-y divide-gray-100">
			{#each data.itemType.items as item}
				<li class="flex items-center justify-between gap-3 px-4 py-3">
					<div>
						<p class="text-sm font-medium text-gray-900">{item.name}</p>
						{#if Object.keys(item.attributes).length > 0}
						<div class="mt-0.5 flex flex-wrap gap-1">
							{#each Object.entries(item.attributes) as [k, v]}
								<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{k}: {v}</span>
							{/each}
						</div>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if data.canEdit}
						<form method="POST" action="?/updateItemStatus" use:enhance>
							<input type="hidden" name="itemId" value={item.id} />
							<select name="status"
								onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
								class="rounded-lg border border-gray-300 px-2 py-1 text-xs {STATUS_COLORS[item.status] ?? ''}">
								{#each Object.entries(STATUS_LABELS) as [val, label]}
									<option value={val} selected={item.status === val}>{label}</option>
								{/each}
							</select>
						</form>
						<form method="POST" action="?/deleteItem" use:enhance>
							<input type="hidden" name="itemId" value={item.id} />
							<button type="submit"
								onclick={(e) => { if (!confirm('Delete this item?')) e.preventDefault(); }}
								class="rounded p-1 text-gray-400 hover:text-red-500">
								<Trash2 size={14} />
							</button>
						</form>
						{:else}
						<span class="rounded-full px-2 py-0.5 text-xs {STATUS_COLORS[item.status] ?? ''}">{STATUS_LABELS[item.status]}</span>
						{/if}
					</div>
				</li>
			{/each}
			</ul>
		{/if}
	</div>
	{:else}
	<div class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 font-semibold text-gray-900">Pool summary</h2>
		<div class="flex items-center gap-6 text-sm">
			<div>
				<p class="text-gray-500">Total pool</p>
				<p class="text-2xl font-bold text-gray-900">{data.itemType.totalPoolSize ?? '—'}</p>
			</div>
		</div>
		<p class="mt-3 text-xs text-gray-400">Availability calculated dynamically from active bookings.</p>
	</div>
	{/if}

	{#if data.canEdit}
	<div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
		<h2 class="mb-3 text-sm font-semibold text-gray-900">Actions</h2>
		<div class="flex flex-wrap gap-2">
			<form method="POST" action="?/toggle" use:enhance>
				<button type="submit" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
					{data.itemType.active ? 'Deactivate' : 'Activate'}
				</button>
			</form>
			<form method="POST" action="?/delete" use:enhance>
				<button type="submit"
					onclick={(e) => { if (!confirm('Delete this item type and all its items?')) e.preventDefault(); }}
					class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
					Delete item type
				</button>
			</form>
		</div>
	</div>
	{/if}
</div>
