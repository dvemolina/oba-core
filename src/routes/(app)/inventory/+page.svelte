<script lang="ts">
	import { Package, Plus, Tag } from 'lucide-svelte';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();

</script>

<div class="mx-auto max-w-4xl p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">{m.inventory_page_title()}</h1>
			<p class="mt-1 text-sm text-gray-500">{m.inventory_page_subtitle()}</p>
		</div>
		<a
			href="/inventory/new"
			class="flex items-center gap-2 rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean/90"
		>
			<Plus size={16} />
			{m.inventory_btn_new_type()}
		</a>
	</div>

	{#if data.itemTypes.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
			<Package size={40} class="mb-3 text-gray-300" />
			<p class="font-medium text-gray-500">{m.inventory_empty_title()}</p>
			<p class="mt-1 text-sm text-gray-400">{m.inventory_empty_desc()}</p>
			<a href="/inventory/new" class="mt-4 rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white hover:bg-ocean/90">
				{m.inventory_empty_btn()}
			</a>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.itemTypes as type}
				<a
					href="/inventory/{type.id}"
					class="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-ocean/30 hover:shadow-md {!type.active ? 'opacity-60' : ''}"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-2">
							<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean/10 text-ocean">
								<Package size={16} />
							</span>
							<div>
								<p class="font-semibold text-gray-900 group-hover:text-ocean">{type.name}</p>
								{#if !type.active}
									<span class="text-xs text-gray-400">{m.inventory_badge_inactive()}</span>
								{/if}
							</div>
						</div>
						<span class="rounded-full px-2 py-0.5 text-xs font-medium {type.trackingMode === 'pool' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}">
							{type.trackingMode === 'pool' ? m.inventory_badge_pool() : m.inventory_badge_specific()}
						</span>
					</div>

					{#if type.description}
						<p class="text-sm text-gray-500 line-clamp-2">{type.description}</p>
					{/if}

					{#if type.trackingMode === 'pool' && type.totalPoolSize}
					<div class="text-sm text-gray-500">
						{m.inventory_units_count({ count: type.totalPoolSize })}
					</div>
					{/if}

					{#if Object.keys(type.attributeSchema).length > 0}
						<div class="flex flex-wrap gap-1">
							{#each Object.entries(type.attributeSchema) as [key, values]}
								<span class="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
									<Tag size={10} />
									{key}: {values.join(', ')}
								</span>
							{/each}
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
