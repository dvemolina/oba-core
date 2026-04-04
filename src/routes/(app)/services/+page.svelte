<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '$lib/features/services/types';

	let { data }: { data: PageData } = $props();

	const typeLabels: Record<string, string> = {
		lesson: 'Lesson',
		camp: 'Camp',
		product: 'Product',
		rental: 'Rental'
	};

	const grouped = $derived(
		data.services.reduce<Record<string, Service[]>>((acc, s) => {
			(acc[s.type] ??= []).push(s);
			return acc;
		}, {})
	);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Services</h1>
		<a
			href="/services/new"
			class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90"
		>
			+ New
		</a>
	</div>

	{#each Object.entries(grouped) as [type, items]}
		<section class="mb-6">
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
				{typeLabels[type]}
			</h2>
			<div class="space-y-2">
				{#each items as service}
					<a
						href="/services/{service.id}"
						class="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
					>
						<div>
							<p class="font-medium text-gray-800 {!service.active ? 'line-through opacity-50' : ''}">
								{service.name}
							</p>
							{#if service.durationMinutes}
								<p class="text-xs text-muted">{service.durationMinutes} min</p>
							{/if}
						</div>
						<div class="text-right">
							<p class="font-semibold text-gray-800">€{service.basePrice}</p>
							{#if !service.active}
								<span class="text-xs text-muted">inactive</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/each}

	{#if data.services.length === 0}
		<p class="py-12 text-center text-sm text-muted">No services yet. Add your first one.</p>
	{/if}
</div>
