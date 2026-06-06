<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, ArrowLeft } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let trackingMode = $state<'pool' | 'specific'>('pool');
	let attributes = $state<{ key: string; values: string }[]>([]);
	let loading = $state(false);

	const PRICING_OPTIONS = [
		{ value: 'per_hour', label: 'Per hour' },
		{ value: 'per_half_day', label: 'Per half-day' },
		{ value: 'per_day', label: 'Per day' },
		{ value: 'per_night', label: 'Per night' },
		{ value: 'per_session', label: 'Per session' },
		{ value: 'flat', label: 'Flat fee' }
	];

	function addAttribute() {
		attributes.push({ key: '', values: '' });
	}

	function removeAttribute(i: number) {
		attributes.splice(i, 1);
	}
</script>

<div class="mx-auto max-w-xl p-4 md:p-6">
	<div class="mb-6">
		<a href="/inventory" class="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
			<ArrowLeft size={14} /> Back to inventory
		</a>
		<h1 class="text-2xl font-bold text-gray-900">New item type</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}

	<form method="POST" use:enhance={() => { loading = true; return ({ update }) => { loading = false; update(); }; }}>
		<div class="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="name">Name *</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					placeholder="e.g. Wetsuit, Surfboard, Kayak, Room"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="description">Description</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				></textarea>
			</div>

			<div>
				<p class="mb-2 text-sm font-medium text-gray-700">Tracking mode *</p>
				<div class="grid grid-cols-2 gap-3">
					<label class="flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition {trackingMode === 'pool' ? 'border-ocean bg-ocean/5' : 'border-gray-200'}">
						<input type="radio" name="trackingMode" value="pool" bind:group={trackingMode} class="sr-only" />
						<span class="font-medium text-sm">Pool</span>
						<span class="text-xs text-gray-500">Track total count only (e.g. 20 wetsuits)</span>
					</label>
					<label class="flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition {trackingMode === 'specific' ? 'border-ocean bg-ocean/5' : 'border-gray-200'}">
						<input type="radio" name="trackingMode" value="specific" bind:group={trackingMode} class="sr-only" />
						<span class="font-medium text-sm">Specific items</span>
						<span class="text-xs text-gray-500">Track each item individually (e.g. Room A, Board #3)</span>
					</label>
				</div>
			</div>

			{#if trackingMode === 'pool'}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="totalPoolSize">Total pool size *</label>
					<input
						id="totalPoolSize"
						name="totalPoolSize"
						type="number"
						min="1"
						required
						placeholder="e.g. 20"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					/>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="unitPrice">Price *</label>
					<input
						id="unitPrice"
						name="unitPrice"
						type="number"
						step="0.01"
						min="0"
						required
						placeholder="0.00"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="pricingUnit">Pricing unit *</label>
					<select
						id="pricingUnit"
						name="pricingUnit"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					>
						{#each PRICING_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="capacity">
					Capacity per unit <span class="font-normal text-gray-400">(optional, e.g. 2 guests per room)</span>
				</label>
				<input
					id="capacity"
					name="capacity"
					type="number"
					min="1"
					placeholder="Leave blank for gear/equipment"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				/>
			</div>

			<div>
				<div class="mb-2 flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-700">Attributes</p>
						<p class="text-xs text-gray-400">Define variant dimensions (e.g. size, style, color)</p>
					</div>
					<button type="button" onclick={addAttribute} class="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
						<Plus size={12} /> Add attribute
					</button>
				</div>

				{#if attributes.length === 0}
					<p class="text-xs text-gray-400 italic">No attributes — items will be generic</p>
				{/if}

				{#each attributes as attr, i}
					<div class="mb-2 flex items-start gap-2">
						<div class="flex-1">
							<input
								type="text"
								name="attributeKey"
								bind:value={attr.key}
								placeholder="Key (e.g. size)"
								class="mb-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
							/>
							<input
								type="text"
								name="attributeValues"
								bind:value={attr.values}
								placeholder="Values, comma-separated (e.g. XS, S, M, L, XL)"
								class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
							/>
						</div>
						<button type="button" onclick={() => removeAttribute(i)} class="mt-1 rounded p-1 text-gray-400 hover:text-red-500">
							<Trash2 size={14} />
						</button>
					</div>
				{/each}
			</div>
		</div>

		<div class="mt-4 flex justify-end gap-3">
			<a href="/inventory" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
				Cancel
			</a>
			<button
				type="submit"
				disabled={loading}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean/90 disabled:opacity-50"
			>
				{loading ? 'Creating…' : 'Create item type'}
			</button>
		</div>
	</form>
</div>
