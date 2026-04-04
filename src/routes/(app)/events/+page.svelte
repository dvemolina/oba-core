<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Events</h1>
		<a
			href="/events/new"
			class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90"
			>+ New</a
		>
	</div>
	<div class="space-y-2">
		{#each data.events as event}
			<a
				href="/events/{event.id}"
				class="block rounded-(--radius-card) bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="font-medium text-gray-800">🏕️ {event.title}</p>
						<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						{#if event.description}<p class="mt-1 text-sm text-gray-600">{event.description}</p>{/if}
					</div>
					{#if event.price}
						<p class="shrink-0 font-semibold text-gray-800">€{event.price}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
	{#if data.events.length === 0}
		<p class="py-12 text-center text-sm text-muted">No events yet.</p>
	{/if}
</div>
