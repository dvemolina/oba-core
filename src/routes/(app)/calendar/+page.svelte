<script lang="ts">
	import { goto } from '$app/navigation';
	import { groupBookingsByDate, getDaysInMonth } from '$lib/features/calendar/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupBookingsByDate(data.bookings));
	const today = $derived(data.today);

	function setView(v: 'agenda' | 'month') {
		goto(`/calendar?view=${v}&year=${data.year}&month=${data.month}`);
	}

	function prevMonth() {
		let y = data.year, m = data.month - 1;
		if (m < 1) { m = 12; y--; }
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	function nextMonth() {
		let y = data.year, m = data.month + 1;
		if (m > 12) { m = 1; y++; }
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	const monthName = $derived(
		new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })
	);

	// Month grid helpers
	// getDay(): 0=Sun,1=Mon...6=Sat → convert to Mon-first: (d+6)%7
	const firstDayOffset = $derived((new Date(data.year, data.month - 1, 1).getDay() + 6) % 7);
	const daysInMonth = $derived(getDaysInMonth(data.year, data.month));
	const numWeeks = $derived(Math.ceil((firstDayOffset + daysInMonth) / 7));
	const trailingBlanks = $derived(numWeeks * 7 - firstDayOffset - daysInMonth);

	function statusChip(status: string) {
		if (status === 'confirmed') return 'bg-confirmed/20 text-green-800';
		if (status === 'cancelled') return 'bg-red-100 text-red-600 line-through opacity-60';
		return 'bg-pending/25 text-amber-800';
	}

	// Agenda helpers
	const upcomingDates = $derived(
		Object.keys(grouped).filter((d) => d >= today).sort()
	);
	const pastDates = $derived(
		Object.keys(grouped).filter((d) => d < today).sort().reverse()
	);

	function statusClass(status: string) {
		if (status === 'confirmed') return 'border-confirmed bg-confirmed/5';
		if (status === 'cancelled') return 'border-flexible bg-flexible/5 opacity-50';
		return 'border-pending bg-pending/5';
	}
	function flexClass(f: boolean) { return f ? 'border-dashed' : 'border-solid'; }
</script>

<!-- Root: h-full when month so grid fills viewport; auto when agenda so main scrolls -->
<div class="flex flex-col {data.view === 'month' ? 'h-full overflow-hidden' : ''}">

	<!-- Compact header (always visible) -->
	<div class="flex shrink-0 items-center justify-between border-b border-border bg-sand px-4 py-2">
		<div class="flex items-center gap-1">
			<button onclick={prevMonth} class="flex h-7 w-7 items-center justify-center rounded-md text-lg text-muted hover:bg-border hover:text-gray-700">‹</button>
			<h1 class="w-36 text-center text-sm font-bold text-navy">{monthName} {data.year}</h1>
			<button onclick={nextMonth} class="flex h-7 w-7 items-center justify-center rounded-md text-lg text-muted hover:bg-border hover:text-gray-700">›</button>
		</div>
		<div class="flex overflow-hidden rounded-lg bg-surface ring-1 ring-border">
			<button
				onclick={() => setView('month')}
				class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'month' ? 'bg-ocean text-white' : 'text-muted hover:text-gray-700'}"
			>Month</button>
			<button
				onclick={() => setView('agenda')}
				class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'agenda' ? 'bg-ocean text-white' : 'text-muted hover:text-gray-700'}"
			>Agenda</button>
		</div>
	</div>

	<!-- ─── MONTH VIEW ─── -->
	{#if data.view === 'month'}
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Weekday headers -->
			<div class="grid shrink-0 grid-cols-7 border-b border-border bg-sand">
				{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as d}
					<div class="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">{d}</div>
				{/each}
			</div>

			<!-- Grid — fills all remaining space -->
			<div
				class="grid flex-1 grid-cols-7 overflow-hidden"
				style="grid-template-rows: repeat({numWeeks}, 1fr)"
			>
				<!-- Leading blank cells -->
				{#each Array(firstDayOffset) as _}
					<div class="border-b border-r border-border/50 bg-sand/40"></div>
				{/each}

				<!-- Day cells -->
				{#each Array.from({ length: daysInMonth }, (_, i) => i + 1) as day}
					{@const dateStr = `${data.year}-${String(data.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
					{@const isToday = dateStr === today}
					{@const dayBookings = grouped[dateStr] ?? []}
					{@const visible = dayBookings.slice(0, 2)}
					{@const overflow = dayBookings.length - visible.length}

					<!-- Whole-cell is clickable; chips sit on top via z-10 -->
					<div class="group relative flex flex-col gap-px overflow-hidden border-b border-r border-border p-0.5 transition-colors
						{isToday ? 'bg-ocean/5 hover:bg-ocean/10' : 'bg-surface hover:bg-sand'}">

						<!-- Background link covers the whole cell -->
						<a
							href="/calendar/{dateStr}"
							class="absolute inset-0 z-0"
							aria-label="Open {dateStr}"
						></a>

						<!-- Day number — on top of the background link -->
						<div class="relative z-10 mb-0.5 flex justify-end">
							<span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold
								{isToday ? 'bg-ocean text-white' : 'text-gray-500 group-hover:bg-ocean/15 group-hover:text-ocean'}">
								{day}
							</span>
						</div>

						<!-- Events — relative z-10 so clicks go to event, not the day -->
						{#each data.events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr) as event}
							<a
								href="/events/{event.id}"
								class="relative z-10 block truncate rounded bg-confirmed/20 px-1 py-px text-[10px] font-medium leading-tight text-green-800 hover:bg-confirmed/35"
							>
								<span class="hidden sm:inline">🏕️ {event.title}</span>
								<span class="sm:hidden">🏕️</span>
							</a>
						{/each}

						<!-- Booking chips — relative z-10 -->
						{#each visible as booking}
							<a
								href="/bookings/{booking.id}"
								class="relative z-10 block truncate rounded px-1 py-px text-[10px] leading-tight hover:brightness-95 {statusChip(booking.status)}"
							>
								<span class="hidden sm:inline">
									{booking.time ? booking.time.slice(0,5) + ' ' : ''}{booking.serviceName}{booking.firstClientName ? ' · ' + booking.firstClientName : ''}
								</span>
								<span class="sm:hidden" style="color:inherit">●</span>
							</a>
						{/each}

						<!-- +N more — relative z-10, goes to day view -->
						{#if overflow > 0}
							<a
								href="/calendar/{dateStr}"
								class="relative z-10 pl-1 text-[10px] text-muted hover:text-ocean"
							>+{overflow} more</a>
						{/if}
					</div>
				{/each}

				<!-- Trailing blank cells -->
				{#each Array(trailingBlanks) as _}
					<div class="border-b border-r border-border/50 bg-sand/40"></div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ─── AGENDA VIEW ─── -->
	{#if data.view === 'agenda'}
		<div class="space-y-6 px-4 py-4">
			<!-- Multi-day events -->
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

			{#if upcomingDates.length === 0 && data.events.length === 0}
				<p class="py-12 text-center text-sm text-muted">No upcoming bookings.</p>
			{/if}

			{#each upcomingDates as date}
				<div id={date}>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
						{date === today
							? 'Today'
							: new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
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
										{booking.instructorName ?? 'No instructor'} · {booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}
									</p>
								</div>
								<span class="rounded-full px-2 py-0.5 text-xs {booking.status === 'confirmed' ? 'bg-confirmed/15 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-pending/30 text-amber-700'}">
									{booking.status}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}

			{#if pastDates.length > 0}
				<details class="mt-6">
					<summary class="cursor-pointer text-xs text-muted hover:text-gray-600">
						Past bookings ({pastDates.reduce((n, d) => n + grouped[d].length, 0)})
					</summary>
					<div class="mt-3 space-y-4">
						{#each pastDates as date}
							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
									{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
								</p>
								<div class="space-y-2">
									{#each grouped[date] as booking}
										<a
											href="/bookings/{booking.id}"
											class="flex items-center justify-between rounded-(--radius-card) border-l-4 bg-surface p-3 opacity-70 ring-1 ring-border {statusClass(booking.status)} {flexClass(booking.isFlexible)}"
										>
											<p class="text-sm text-gray-700">{booking.time?.slice(0, 5) ?? '—'} · {booking.serviceName}</p>
											<span class="text-xs text-muted">{booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}</span>
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

<!-- FAB -->
<a
	href="/bookings/new"
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-2xl text-white shadow-lg transition-colors hover:bg-ocean/90 md:bottom-6"
	aria-label="New booking"
>+</a>
