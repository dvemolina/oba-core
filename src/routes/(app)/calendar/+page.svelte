<script lang="ts">
	import { goto } from '$app/navigation';
	import { groupBookingsByDate, getDaysInMonth } from '$lib/features/calendar/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupBookingsByDate(data.bookings));

	// Dates that have bookings (for month view dots)
	const datesWithBookings = $derived(new Set(Object.keys(grouped)));

	function setView(v: 'agenda' | 'month') {
		goto(`/calendar?view=${v}&year=${data.year}&month=${data.month}`);
	}

	function prevMonth() {
		let y = data.year,
			m = data.month - 1;
		if (m < 1) {
			m = 12;
			y--;
		}
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	function nextMonth() {
		let y = data.year,
			m = data.month + 1;
		if (m > 12) {
			m = 1;
			y++;
		}
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	const monthName = $derived(
		new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })
	);

	// Agenda: group into past + upcoming
	const today = data.today;
	const upcomingDates = $derived(
		Object.keys(grouped)
			.filter((d) => d >= today)
			.sort()
	);
	const pastDates = $derived(
		Object.keys(grouped)
			.filter((d) => d < today)
			.sort()
			.reverse()
	);

	function statusClass(status: string) {
		if (status === 'confirmed') return 'border-confirmed bg-confirmed/5';
		if (status === 'cancelled') return 'border-flexible bg-flexible/5 opacity-50';
		return 'border-pending bg-pending/5';
	}

	function flexClass(isFlexible: boolean) {
		return isFlexible ? 'border-dashed' : 'border-solid';
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="sticky top-0 z-10 border-b border-border bg-sand px-4 py-3">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<button onclick={prevMonth} class="p-1 text-muted hover:text-gray-700">‹</button>
				<h1 class="font-bold text-navy">{monthName} {data.year}</h1>
				<button onclick={nextMonth} class="p-1 text-muted hover:text-gray-700">›</button>
			</div>
			<!-- View toggle -->
			<div class="flex overflow-hidden rounded-lg bg-surface ring-1 ring-border">
				<button
					onclick={() => setView('agenda')}
					class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'agenda'
						? 'bg-ocean text-white'
						: 'text-muted hover:text-gray-700'}"
				>List</button>
				<button
					onclick={() => setView('month')}
					class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'month'
						? 'bg-ocean text-white'
						: 'text-muted hover:text-gray-700'}"
				>Month</button>
			</div>
		</div>

		<!-- Month grid (when view=month) -->
		{#if data.view === 'month'}
			<div class="grid grid-cols-7 gap-0.5 text-center">
				{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as d}
					<div class="py-1 text-xs text-muted">{d}</div>
				{/each}
				{#each Array.from({
					length:
						new Date(data.year, data.month - 1, 1).getDay() === 0
							? 6
							: new Date(data.year, data.month - 1, 1).getDay() - 1
				}) as _}
					<div></div>
				{/each}
				{#each Array.from({ length: getDaysInMonth(data.year, data.month) }, (_, i) => i + 1) as day}
					{@const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
					{@const isToday = dateStr === today}
					{@const hasBookings = datesWithBookings.has(dateStr)}
					<a
						href="/calendar?view=agenda&year={data.year}&month={data.month}#{dateStr}"
						class="flex flex-col items-center rounded-lg py-1 transition-colors hover:bg-ocean/5"
					>
						<span
							class="flex h-6 w-6 items-center justify-center rounded-full text-xs {isToday
								? 'bg-ocean font-bold text-white'
								: 'text-gray-700'}">{day}</span>
						{#if hasBookings}
							<span class="mt-0.5 h-1 w-1 rounded-full bg-ocean"></span>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Agenda list -->
	{#if data.view === 'agenda'}
		<div class="flex-1 space-y-6 overflow-y-auto px-4 py-4">
			<!-- Events (camps / fixed blocks) -->
			{#each data.events as event}
				<a
					href="/events/{event.id}"
					class="block rounded-(--radius-card) border border-confirmed/30 bg-confirmed/10 p-3"
				>
					<div class="flex items-center gap-2">
						<span class="text-base">🏕️</span>
						<div>
							<p class="text-sm font-semibold text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</div>
				</a>
			{/each}

			<!-- Upcoming bookings -->
			{#if upcomingDates.length === 0 && data.events.length === 0}
				<p class="py-12 text-center text-sm text-muted">No upcoming bookings.</p>
			{/if}
			{#each upcomingDates as date}
				<div id={date}>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
						{date === today
							? 'Today'
							: new Date(date + 'T00:00:00').toLocaleDateString('default', {
									weekday: 'short',
									day: 'numeric',
									month: 'short'
								})}
					</p>
					<div class="space-y-2">
						{#each grouped[date] as booking}
							<a
								href="/bookings/{booking.id}"
								class="flex items-center justify-between rounded-(--radius-card) border-l-4 bg-surface p-3 ring-1 ring-border {statusClass(booking.status)} {flexClass(booking.isFlexible)}"
							>
								<div>
									<p class="text-sm font-medium text-gray-800">
										{booking.time ? booking.time.slice(0, 5) : '—'}
										{#if booking.isFlexible}<span class="ml-1 text-flexible">⚡</span>{/if}
										· {booking.serviceName}
									</p>
									<p class="text-xs text-muted">
										{booking.instructorName ?? 'No instructor'} · {booking.clientCount} client{booking.clientCount !==
										1
											? 's'
											: ''}
									</p>
								</div>
								<span
									class="rounded-full px-2 py-0.5 text-xs {booking.status === 'confirmed'
										? 'bg-confirmed/15 text-green-700'
										: booking.status === 'cancelled'
											? 'bg-red-100 text-red-600'
											: 'bg-pending/30 text-amber-700'}"
								>
									{booking.status}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Past bookings (collapsed) -->
			{#if pastDates.length > 0}
				<details class="mt-6">
					<summary class="cursor-pointer text-xs text-muted hover:text-gray-600"
						>Past bookings ({pastDates.reduce((n, d) => n + grouped[d].length, 0)})</summary
					>
					<div class="mt-3 space-y-4">
						{#each pastDates as date}
							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
									{new Date(date + 'T00:00:00').toLocaleDateString('default', {
										weekday: 'short',
										day: 'numeric',
										month: 'short'
									})}
								</p>
								<div class="space-y-2">
									{#each grouped[date] as booking}
										<a
											href="/bookings/{booking.id}"
											class="flex items-center justify-between rounded-(--radius-card) border-l-4 bg-surface p-3 opacity-70 ring-1 ring-border {statusClass(booking.status)} {flexClass(booking.isFlexible)}"
										>
											<p class="text-sm text-gray-700"
												>{booking.time?.slice(0, 5) ?? '—'} · {booking.serviceName}</p
											>
											<span class="text-xs text-muted"
												>{booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}</span
											>
										</a>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/if}
		</div>
	{/if}
</div>

<!-- FAB: New booking -->
<a
	href="/bookings/new"
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-2xl text-white shadow-lg transition-colors hover:bg-ocean/90 md:bottom-6"
	aria-label="New booking"
>
	+
</a>
