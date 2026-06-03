<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	let activeRunId = $state(data.focusRunId ?? data.runs[0]?.id ?? '');
	const activeRun = $derived(data.runs.find(r => r.id === activeRunId));
	const activeBookings = $derived(data.bookingsByRun[activeRunId] ?? []);
	const totalEnrolled = $derived(activeBookings.reduce((s, b) => s + (b.clientCount ?? 0), 0));
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">← {data.service.name}</a>
		<h1 class="text-xl font-bold text-navy">Camp Roster</h1>
	</div>

	{#if data.runs.length === 0}
		<div class="rounded-lg bg-sand p-6 text-center">
			<p class="text-sm text-muted">No runs yet for this service.</p>
			<a href="/services/{data.service.id}" class="mt-2 block text-sm text-ocean hover:underline">Add a run →</a>
		</div>
	{:else}
		<!-- Run tabs -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each data.runs as run}
				<button
					onclick={() => activeRunId = run.id}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {activeRunId === run.id ? 'bg-ocean text-white' : 'bg-surface ring-1 ring-border hover:ring-ocean/50'}"
				>
					{run.startDate} → {run.endDate}
					{#if run.maxCapacity}
						<span class="ml-1 text-xs opacity-75">
							{(data.bookingsByRun[run.id] ?? []).reduce((s, b) => s + (b.clientCount ?? 0), 0)}/{run.maxCapacity}
						</span>
					{/if}
				</button>
			{/each}
			<a href="/services/{data.service.id}" class="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-border hover:ring-ocean/50">
				+ Add run
			</a>
		</div>

		{#if activeRun}
			<!-- Run summary -->
			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-semibold text-gray-800">{activeRun.startDate} → {activeRun.endDate}</p>
						{#if activeRun.maxCapacity}
							<p class="text-xs text-muted">{totalEnrolled} / {activeRun.maxCapacity} spots filled</p>
						{:else}
							<p class="text-xs text-muted">{totalEnrolled} enrolled</p>
						{/if}
						{#if activeRun.notes}
							<p class="mt-0.5 text-xs text-muted">{activeRun.notes}</p>
						{/if}
					</div>
					<a
						href="/bookings/new?serviceId={data.service.id}"
						class="btn-primary btn-sm"
					>
						+ Book client
					</a>
				</div>
			</div>

			<!-- Roster -->
			{#if activeBookings.length === 0}
				<p class="py-8 text-center text-sm text-muted">No bookings for this run yet.</p>
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
