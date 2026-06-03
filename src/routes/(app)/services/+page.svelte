<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '$lib/features/services/types';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';

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
		<h1 class="text-xl font-semibold text-navy">Services</h1>
		<a href="/services/new" class="btn-primary btn-sm">+ New</a>
	</div>

	{#each Object.entries(grouped) as [type, items]}
		<section class="mb-6">
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
				{typeLabels[type] ?? type}
			</h2>
			<div class="space-y-2">
				{#each items as service}
					<div class="rounded-(--radius-card) bg-surface ring-1 ring-border hover:ring-ocean/50 {!service.active ? 'opacity-60' : ''}">
						<a href="/services/{service.id}" class="flex items-center justify-between p-4">
							<div>
								<div class="flex items-center gap-2">
									<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {DOT_COLORS[service.color as ServiceColorKey] ?? DOT_COLORS['ocean']}"></span>
									<p class="font-medium text-gray-800 {!service.active ? 'line-through opacity-50' : ''}">
										{service.name}
									</p>
								</div>
								{#if service.durationMinutes}
									<p class="text-xs text-muted">{service.durationMinutes} min</p>
								{/if}
								{#if service.maxCapacity}
									<p class="text-xs text-muted">Max {service.maxCapacity}</p>
								{/if}
							</div>
							<div class="text-right">
								<p class="font-semibold text-gray-800">€{service.basePrice}</p>
								{#if !service.active}
									<span class="text-xs text-muted">inactive</span>
								{/if}
							</div>
						</a>
						{#if service.hasRoster}
							<div class="border-t border-border/50 px-4 py-2">
								<a
									href="/bookings/camp/{service.id}"
									class="text-xs font-medium text-ocean hover:underline"
								>🏕️ Open Roster →</a>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}

	{#if data.services.length === 0}
		<p class="py-12 text-center text-sm text-muted">No services yet. Add your first one.</p>
	{/if}
</div>
