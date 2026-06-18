<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '$lib/features/services/types';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();

	const typeLabels = $derived<Record<string, string>>({
		lesson: m.service_list_type_lesson(),
		camp: m.service_list_type_camp(),
		product: m.service_list_type_product(),
		rental: m.service_list_type_rental(),
		accommodation: m.service_list_type_accommodation(),
		other: m.service_list_type_other()
	});

	const grouped = $derived(
		data.services.reduce<Record<string, Service[]>>((acc, s) => {
			(acc[s.type] ??= []).push(s);
			return acc;
		}, {})
	);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold text-navy">{m.service_list_title()}</h1>
		<a href="/services/new" class="btn-primary btn-sm">{m.common_new()}</a>
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
								{#if data.runsByService[service.id]?.length}
									{#each data.runsByService[service.id] as run}
										<p class="text-xs text-muted">{run.startDate} → {run.endDate}{run.maxCapacity ? ` · ${run.enrolledCount}/${run.maxCapacity}` : ''}</p>
									{/each}
								{/if}
								{#if service.maxCapacity && !data.runsByService[service.id]?.length}
									<p class="text-xs text-muted">{m.common_max()} {service.maxCapacity}</p>
								{/if}
							</div>
							<div class="text-right">
								<p class="font-semibold text-gray-800">€{service.basePrice}</p>
								{#if !service.active}
									<span class="text-xs text-muted">{m.common_inactive()}</span>
								{/if}
							</div>
						</a>
						{#if service.modules?.roster && data.runsByService[service.id]?.length}
							<div class="border-t border-border/50 px-4 py-2">
								<a
									href="/services/{service.id}/roster"
									class="text-xs font-medium text-ocean hover:underline"
								>{m.service_list_open_roster()}</a>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}

	{#if data.services.length === 0}
		<p class="py-12 text-center text-sm text-muted">{m.service_list_empty()}</p>
	{/if}
</div>
