<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import { fmtTimeRange } from '$lib/features/calendar/utils';
	import type { PageData } from './$types';
	import type { AgendaSession } from '$lib/features/sessions/types';
	import type { BookingSummary } from '$lib/features/bookings/types';

	let { data }: { data: PageData } = $props();

	const today = $derived(data.today);

	// ── Helpers ──────────────────────────────────────────────────────────────────

	function fmtDate(d: string) {
		const date = new Date(d + 'T00:00:00');
		if (d === today) return 'Today';
		return date.toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function fmtTime(t: string | null) {
		return t ? t.slice(0, 5) : null;
	}

	function sessionCardBorder(s: AgendaSession) {
		if (s.status === 'unscheduled') return 'border-amber-300 bg-amber-50/40';
		const c = getServiceColor(s.serviceColor ?? '');
		return `${c.border} bg-surface`;
	}

	// ── Date grouping ─────────────────────────────────────────────────────────────

	// All unique dates that have sessions or non-session bookings
	const allDates = $derived((): string[] => {
		const set = new Set<string>();
		for (const s of data.sessions) set.add(s.date);
		for (const b of data.nonSessionBookings) set.add(b.date);
		return [...set].sort();
	});

	function sessionsForDate(date: string): AgendaSession[] {
		return data.sessions.filter(s => s.date === date);
	}

	function nonSessionBookingsForDate(date: string): BookingSummary[] {
		return data.nonSessionBookings.filter(b => b.date === date);
	}

	const upcomingDates = $derived(allDates().filter(d => d >= today));
	const pastDates = $derived(allDates().filter(d => d < today).reverse());

	// Unscheduled sessions in the upcoming window
	const unscheduled = $derived(
		data.sessions.filter(s => s.status === 'unscheduled' && s.date >= today)
	);

	// ── Subtitle for non-session bookings ─────────────────────────────────────────
	function nonSessionSubtitle(b: BookingSummary): string {
		if (b.serviceHasRoster) {
			const max = b.serviceMaxCapacity;
			return max != null ? `${b.clientCount}/${max} enrolled` : `${b.clientCount} enrolled`;
		}
		return b.instructorName ?? (b.firstClientName ?? '—');
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="page-header">
		<h1 class="page-title">Agenda</h1>
	</div>

	<!-- Stats strip -->
	<div class="grid grid-cols-3 divide-x divide-border border-b border-border bg-surface">
		<div class="flex flex-col items-center py-3">
			<span class="text-xl font-bold text-navy">{data.stats.scheduledToday}</span>
			<span class="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">Today</span>
		</div>
		<div class="flex flex-col items-center py-3">
			<span class="text-xl font-bold {data.stats.unscheduledTotal > 0 ? 'text-amber-600' : 'text-navy'}">
				{data.stats.unscheduledTotal}
			</span>
			<span class="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">Unscheduled</span>
		</div>
		<div class="flex flex-col items-center py-3">
			<span class="text-xl font-bold {data.stats.pendingRevenue > 0 ? 'text-flexible' : 'text-navy'}">
				€{data.stats.pendingRevenue.toFixed(0)}
			</span>
			<span class="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">Pending</span>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto">
		<div class="space-y-6 px-4 py-4">

			<!-- Active events (legacy event objects) -->
			{#each data.events as event}
				<a href="/events/{event.id}" class="block rounded-(--radius-card) border border-confirmed/30 bg-confirmed/10 p-3">
					<p class="text-sm font-semibold text-gray-800">{event.title}</p>
					<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
				</a>
			{/each}

			<!-- Active camp banners -->
			{#each data.activeCamps as camp}
				{@const c = getServiceColor(camp.serviceColor ?? '')}
				<a href="/bookings/{camp.id}"
					class="block rounded-(--radius-card) border-l-4 p-3 ring-1 ring-border {c.border} bg-surface">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wider text-muted">Camp</p>
							<p class="text-sm font-semibold text-gray-800">{camp.serviceName}</p>
							<p class="text-xs text-muted">{camp.date} → {camp.dateEnd} · {camp.clientCount}{camp.serviceMaxCapacity != null ? `/${camp.serviceMaxCapacity}` : ''} enrolled</p>
						</div>
						<span class="rounded-full px-2 py-0.5 text-xs {camp.status === 'confirmed' ? 'bg-confirmed/15 text-green-700' : 'bg-pending/30 text-amber-700'}">{camp.status}</span>
					</div>
				</a>
			{/each}

			<!-- Unscheduled sessions alert -->
			{#if unscheduled.length > 0}
				<div class="rounded-(--radius-card) border border-amber-200 bg-amber-50 p-3">
					<p class="text-xs font-semibold text-amber-800">{unscheduled.length} session{unscheduled.length > 1 ? 's' : ''} need a time assigned</p>
					<div class="mt-2 space-y-1.5">
						{#each unscheduled.slice(0, 4) as s}
							<a href="/bookings/{s.bookingId}" class="flex items-center gap-2 text-xs text-amber-700 hover:underline">
								<span>·</span>
								<span>{fmtDate(s.date)} · {s.serviceName ?? 'Session'}
									{#if s.clientName} · {s.clientName}{/if}
								</span>
							</a>
						{/each}
						{#if unscheduled.length > 4}
							<p class="text-xs text-amber-600">+{unscheduled.length - 4} more</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if upcomingDates.length === 0 && data.events.length === 0 && data.activeCamps.length === 0}
				<p class="py-16 text-center text-sm text-muted">No upcoming sessions or bookings.</p>
			{/if}

			<!-- Upcoming dates -->
			{#each upcomingDates as date}
				{@const daySessions = sessionsForDate(date)}
				{@const dayBookings = nonSessionBookingsForDate(date)}
				<div id={date}>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{fmtDate(date)}</p>
					<div class="space-y-2">

						<!-- Sessions -->
						{#each daySessions as s}
							{@const c = getServiceColor(s.serviceColor ?? '')}
							<a href="/bookings/{s.bookingId}"
								class="flex items-start justify-between rounded-(--radius-card) border-l-4 p-3 ring-1 ring-border {sessionCardBorder(s)}">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 flex-wrap">
										{#if s.time}
											<span class="text-sm font-semibold text-gray-900">{fmtTimeRange(s.time, s.effectiveDuration)}</span>
										{:else}
											<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">⚡ Unscheduled</span>
										{/if}
										<span class="inline-flex items-center gap-1 text-sm font-medium text-gray-800">
											<span class="inline-block h-2 w-2 shrink-0 rounded-full {c.bg} ring-1 {c.border}"></span>
											{s.serviceName ?? 'Session'}
										</span>
										{#if s.isFlexible}
											<span class="text-flexible text-xs">⚡</span>
										{/if}
									</div>
									<p class="mt-0.5 text-xs text-muted">
										{#if s.serviceHasRoster}
											{s.enrolledCount}{s.maxCapacity != null ? `/${s.maxCapacity}` : ''} enrolled
										{:else if s.clientName}
											{s.clientName}
										{/if}
										{#if s.instructors.length > 0}
											· 🌊 {s.instructors.map(i => i.instructorName).filter(Boolean).join(', ')}
										{/if}
										{#if s.notes}
											· {s.notes}
										{/if}
									</p>
								</div>
								<span class="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] {s.bookingStatus === 'confirmed' ? 'bg-confirmed/15 text-green-700' : 'bg-pending/30 text-amber-700'}">
									{s.bookingStatus}
								</span>
							</a>
						{/each}

						<!-- Non-session bookings (rentals, accommodation, products) -->
						{#each dayBookings as b}
							{@const c = getServiceColor(b.serviceColor ?? '')}
							<a href="/bookings/{b.id}"
								class="flex items-center justify-between rounded-(--radius-card) border-l-4 p-3 ring-1 ring-border {c.border} bg-surface opacity-85">
								<div>
									<p class="text-sm font-medium text-gray-700">{b.serviceName ?? 'Booking'}</p>
									<p class="text-xs text-muted">{nonSessionSubtitle(b)}{b.dateEnd && b.dateEnd !== b.date ? ` · until ${b.dateEnd}` : ''}</p>
								</div>
								<span class="rounded-full px-2 py-0.5 text-[10px] {b.status === 'confirmed' ? 'bg-confirmed/15 text-green-700' : 'bg-pending/30 text-amber-700'}">{b.status}</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Past -->
			{#if pastDates.length > 0}
				<details class="mt-6">
					<summary class="cursor-pointer text-xs text-muted hover:text-gray-600">
						Past ({pastDates.reduce((n, d) => n + sessionsForDate(d).length + nonSessionBookingsForDate(d).length, 0)})
					</summary>
					<div class="mt-3 space-y-4">
						{#each pastDates as date}
							{@const daySessions = sessionsForDate(date)}
							{@const dayBookings = nonSessionBookingsForDate(date)}
							{#if daySessions.length > 0 || dayBookings.length > 0}
								<div>
									<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{fmtDate(date)}</p>
									<div class="space-y-1.5">
										{#each daySessions as s}
											{@const c = getServiceColor(s.serviceColor ?? '')}
											<a href="/bookings/{s.bookingId}"
												class="flex items-center justify-between rounded-(--radius-card) border-l-4 p-3 opacity-60 ring-1 ring-border {c.border} bg-surface">
												<p class="text-sm text-gray-700">
													{fmtTime(s.time) ?? '—'} · {s.serviceName ?? 'Session'}
													{#if s.clientName} · {s.clientName}{/if}
												</p>
												<span class="text-xs text-muted">{s.bookingStatus}</span>
											</a>
										{/each}
										{#each dayBookings as b}
											{@const c = getServiceColor(b.serviceColor ?? '')}
											<a href="/bookings/{b.id}"
												class="flex items-center justify-between rounded-(--radius-card) border-l-4 p-3 opacity-60 ring-1 ring-border {c.border} bg-surface">
												<p class="text-sm text-gray-700">{b.serviceName ?? 'Booking'}</p>
												<span class="text-xs text-muted">{b.clientCount} client{b.clientCount !== 1 ? 's' : ''}</span>
											</a>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</details>
			{/if}

		</div>
	</div>
</div>

<a href="/bookings/new"
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-white shadow-lg shadow-ocean/30 transition-all hover:bg-blue-700 active:scale-95 md:bottom-6"
	aria-label="New booking">
	<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
</a>
