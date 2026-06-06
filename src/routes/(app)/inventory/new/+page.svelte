<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, ArrowLeft } from 'lucide-svelte';
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { form }: { form: ActionData } = $props();

	let trackingMode = $state<'pool' | 'specific'>('pool');
	let attributes = $state<{ key: string; values: string }[]>([]);
	let loading = $state(false);

	const PRICING_OPTIONS = $derived([
		{ value: 'per_hour', label: m.pricing_unit_per_hour() },
		{ value: 'per_half_day', label: m.pricing_unit_per_half_day() },
		{ value: 'per_day', label: m.pricing_unit_per_day() },
		{ value: 'per_night', label: m.pricing_unit_per_night() },
		{ value: 'per_session', label: m.pricing_unit_per_session() },
		{ value: 'flat', label: m.pricing_unit_flat() }
	]);

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
			<ArrowLeft size={14} /> {m.inventory_back()}
		</a>
		<h1 class="text-2xl font-bold text-gray-900">{m.inventory_new_title()}</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}

	<form method="POST" use:enhance={() => { loading = true; return ({ update }) => { loading = false; update(); }; }}>
		<div class="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="name">{m.inventory_field_name()} *</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700" for="description">{m.inventory_field_description()}</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				></textarea>
			</div>

			<div>
				<p class="mb-2 text-sm font-medium text-gray-700">{m.inventory_field_tracking_mode()} *</p>
				<div class="grid grid-cols-2 gap-3">
					<label class="flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition {trackingMode === 'pool' ? 'border-ocean bg-ocean/5' : 'border-gray-200'}">
						<input type="radio" name="trackingMode" value="pool" bind:group={trackingMode} class="sr-only" />
						<span class="font-medium text-sm">{m.inventory_tracking_pool()}</span>
						<span class="text-xs text-gray-500">{m.inventory_tracking_pool_desc()}</span>
					</label>
					<label class="flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition {trackingMode === 'specific' ? 'border-ocean bg-ocean/5' : 'border-gray-200'}">
						<input type="radio" name="trackingMode" value="specific" bind:group={trackingMode} class="sr-only" />
						<span class="font-medium text-sm">{m.inventory_tracking_specific()}</span>
						<span class="text-xs text-gray-500">{m.inventory_tracking_specific_desc()}</span>
					</label>
				</div>
			</div>

			{#if trackingMode === 'pool'}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="totalPoolSize">{m.inventory_field_pool_size()} *</label>
					<input
						id="totalPoolSize"
						name="totalPoolSize"
						type="number"
						min="1"
						required
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
					/>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="unitPrice">{m.inventory_field_price()} *</label>
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
					<label class="mb-1 block text-sm font-medium text-gray-700" for="pricingUnit">{m.inventory_field_pricing_unit()} *</label>
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
					{m.inventory_field_capacity()} <span class="font-normal text-gray-400">({m.inventory_field_capacity_hint()})</span>
				</label>
				<input
					id="capacity"
					name="capacity"
					type="number"
					min="1"
					placeholder={m.inventory_field_capacity_placeholder()}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
				/>
			</div>

			<div>
				<div class="mb-2 flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-700">{m.inventory_field_attributes()}</p>
						<p class="text-xs text-gray-400">{m.inventory_field_attributes_hint()}</p>
					</div>
					<button type="button" onclick={addAttribute} class="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
						<Plus size={12} /> {m.inventory_btn_add_attribute()}
					</button>
				</div>

				{#if attributes.length === 0}
					<p class="text-xs text-gray-400 italic">{m.inventory_attributes_empty()}</p>
				{/if}

				{#each attributes as attr, i}
					<div class="mb-2 flex items-start gap-2">
						<div class="flex-1">
							<input
								type="text"
								name="attributeKey"
								bind:value={attr.key}
								placeholder={m.inventory_attr_key_placeholder()}
								class="mb-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
							/>
							<input
								type="text"
								name="attributeValues"
								bind:value={attr.values}
								placeholder={m.inventory_attr_values_placeholder()}
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
				{m.common_cancel()}
			</a>
			<button
				type="submit"
				disabled={loading}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean/90 disabled:opacity-50"
			>
				{loading ? m.inventory_btn_creating() : m.inventory_btn_create()}
			</button>
		</div>
	</form>
</div>
