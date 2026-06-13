<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { data }: { data: PageData } = $props();

	let activeEditionId = $state(data.focusEditionId ?? data.editions[0]?.id ?? '');
	const activeEdition = $derived(data.editions.find(e => e.id === activeEditionId));
	const activeBookings = $derived(data.bookingsByEdition[activeEditionId] ?? []);
	const totalEnrolled = $derived(activeBookings.reduce((s, b) => s + (b.clientCount ?? 0), 0));
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">← {data.service.name}</a>
		<h1 class="text-xl font-bold text-navy">{m.camp_roster_title()}</h1>
	</div>

	{#if data.editions.length === 0}
		<div class="rounded-lg bg-sand p-6 text-center">
			<p class="text-sm text-muted">{m.camp_roster_no_runs()}</p>
			<a href="/services/{data.service.id}" class="mt-2 block text-sm text-ocean hover:underline">{m.camp_roster_add_run()}</a>
		</div>
	{:else}
		<!-- Edition tabs -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each data.editions as edition}
				<button
					onclick={() => activeEditionId = edition.id}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {activeEditionId === edition.id ? 'bg-ocean text-white' : 'bg-surface ring-1 ring-border hover:ring-ocean/50'}"
				>
					{edition.startDate} → {edition.endDate}
					{#if edition.maxCapacity}
						<span class="ml-1 text-xs opacity-75">
							{(data.bookingsByEdition[edition.id] ?? []).reduce((s, b) => s + (b.clientCount ?? 0), 0)}/{edition.maxCapacity}
						</span>
					{/if}
				</button>
			{/each}
			<a href="/services/{data.service.id}" class="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-border hover:ring-ocean/50">
				{m.camp_roster_add_run_short()}
			</a>
		</div>

		{#if activeEdition}
			<!-- Edition summary -->
			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-semibold text-gray-800">{activeEdition.startDate} → {activeEdition.endDate}</p>
						{#if activeEdition.maxCapacity}
							<p class="text-xs text-muted">{totalEnrolled} / {activeEdition.maxCapacity} {m.camp_roster_spots_filled()}</p>
						{:else}
							<p class="text-xs text-muted">{totalEnrolled} {m.camp_roster_enrolled()}</p>
						{/if}
						{#if activeEdition.notes}
							<p class="mt-0.5 text-xs text-muted">{activeEdition.notes}</p>
						{/if}
					</div>
					<a
						href="/bookings/new?serviceId={data.service.id}"
						class="btn-primary btn-sm"
					>
						{m.camp_roster_book_client()}
					</a>
				</div>
			</div>

			<!-- Roster -->
			{#if activeBookings.length === 0}
				<p class="py-8 text-center text-sm text-muted">{m.camp_roster_no_bookings()}</p>
			{:else}
				<div class="space-y-2">
					{#each activeBookings as booking}
						<a
							href="/bookings/{booking.id}"
							class="flex items-center justify-between rounded-(--radius-card) bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
						>
							<div>
								<p class="font-medium text-gray-800">{booking.firstClientName ?? 'Unknown'}</p>
								{#if booking.clientCount && booking.clientCount > 1}
									<p class="text-xs text-muted">+{booking.clientCount - 1} more</p>
								{/if}
							</div>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-sand text-muted'}">
								{booking.status}
							</span>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
