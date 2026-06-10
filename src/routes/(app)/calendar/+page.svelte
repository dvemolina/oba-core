<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { groupBookingsByDate, getDaysInMonth, addMinutesToTime, checkAllInstructorConflicts } from '$lib/features/calendar/utils';
	import { Tent } from 'lucide-svelte';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';
	import type { BookingSummary } from '$lib/features/bookings/types';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import SessionCard from '$lib/components/calendar/SessionCard.svelte';

	let { data }: { data: PageData } = $props();

	// Scheduling board: track which session is being inline-edited
	let assigningSessionId = $state<string | null>(null);

	// Track form values for the active inline edit (used for real-time conflict detection)
	let editFormTime = $state('');
	let editFormDuration = $state(60);

	// When the active session changes, reset form values from that session's current data
	$effect(() => {
		const s = assigningSessionId ? data.daySessions.find(s => s.id === assigningSessionId) : null;
		editFormTime = s?.time?.slice(0, 5) ?? '';
		editFormDuration = s?.effectiveDuration ?? 60;
	});

	// Real-time instructor conflicts for the currently-editing session
	const editConflicts = $derived(
		assigningSessionId && editFormTime
			? checkAllInstructorConflicts(
				data.instructors.map(i => i.id),
				data.dayDate,
				editFormTime,
				editFormDuration,
				data.daySessions,
				assigningSessionId
			)
			: {} as Record<string, import('$lib/features/calendar/utils').InstructorConflict[]>
	);

	const today = $derived(data.today);

	function setView(v: 'month' | 'week' | 'day') {
		// Preserve date context when switching views (Google Cal / iCal behaviour)
		const ctx = data.view === 'day'  ? data.dayDate
		          : data.view === 'week' ? data.weekStart
		          : `${data.year}-${String(data.month).padStart(2, '0')}-01`;
		const d = new Date(ctx + 'T00:00:00');
		if (v === 'week')  goto(`/calendar?view=week&week=${ctx}`);
		else if (v === 'day') goto(`/calendar?view=day&date=${ctx}`);
		else goto(`/calendar?view=month&year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
	}
	function prevMonth() {
		let y = data.year, m = data.month - 1;
		if (m < 1) { m = 12; y--; }
		goto(`/calendar?view=month&year=${y}&month=${m}`);
	}
	function nextMonth() {
		let y = data.year, m = data.month + 1;
		if (m > 12) { m = 1; y++; }
		goto(`/calendar?view=month&year=${y}&month=${m}`);
	}

	const monthName = $derived(
		new Date(data.year, data.month - 1).toLocaleString(getLocale(), { month: 'long' })
	);

	// ── Week view helpers ─────────────────────────────────────────────────────
	const weekBookingsByDate = $derived(
		data.weekDays.reduce<Record<string, typeof data.bookings>>((acc, d) => {
			acc[d] = data.bookings.filter(
				b => b.status !== 'cancelled' && b.date <= d && (b.dateEnd ?? b.date) >= d
			).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
			return acc;
		}, {})
	);

	const weekLabel = $derived(() => {
		if (!data.weekDays.length) return '';
		const first = new Date(data.weekDays[0] + 'T00:00:00');
		const last  = new Date(data.weekDays[6] + 'T00:00:00');
		const sameMonth = first.getMonth() === last.getMonth();
		const fmt = (d: Date, short = false) =>
			d.toLocaleDateString(getLocale(), short
				? { day: 'numeric' }
				: { month: 'short', day: 'numeric' });
		return sameMonth
			? `${fmt(first, true)} – ${fmt(last)} ${last.getFullYear()}`
			: `${fmt(first)} – ${fmt(last)} ${last.getFullYear()}`;
	});

	// ── Month grid ───────────────────────────────────────────────────────────
	const firstDayOffset = $derived((new Date(data.year, data.month - 1, 1).getDay() + 6) % 7);
	const daysInMonth = $derived(getDaysInMonth(data.year, data.month));

	// Weeks as arrays of date strings (null = blank padding cell)
	const weeks = $derived(() => {
		const result: (string | null)[][] = [];
		const m = String(data.month).padStart(2, '0');
		let cells: (string | null)[] = Array(firstDayOffset).fill(null);
		for (let day = 1; day <= daysInMonth; day++) {
			cells.push(`${data.year}-${m}-${String(day).padStart(2, '0')}`);
			if (cells.length === 7) { result.push(cells); cells = []; }
		}
		if (cells.length > 0) {
			while (cells.length < 7) cells.push(null);
			result.push(cells);
		}
		return result;
	});

	// Multi-day (spanning) bookings — non-cancelled, dateEnd spans more than one day
	const multiDayBookings = $derived(
		data.bookings.filter(b => b.status !== 'cancelled' && b.dateEnd && b.dateEnd !== b.date)
	);

	// Single-day bookings grouped by date
	const singleGrouped = $derived(
		data.bookings
			.filter(b => b.status !== 'cancelled' && (!b.dateEnd || b.dateEnd === b.date))
			.reduce<Record<string, BookingSummary[]>>((acc, b) => {
				(acc[b.date] ??= []).push(b);
				return acc;
			}, {})
	);

	// For each week: compute spanning layout (startCol 0-indexed, span, row for stacking)
	type SpanItem = { booking: BookingSummary; startCol: number; span: number; row: number };

	function weekSpanLayout(weekDates: (string | null)[]): SpanItem[] {
		const firstDay = weekDates.find(d => d !== null);
		const lastDay = [...weekDates].filter(d => d !== null).at(-1);
		if (!firstDay || !lastDay) return [];

		const inWeek = multiDayBookings.filter(b =>
			b.date <= lastDay && (b.dateEnd ?? b.date) >= firstDay
		);

		// Assign each booking to a stack row (greedy, left-to-right)
		const rowEndCols: number[] = [];
		return inWeek.map(b => {
			const bookingEnd = b.dateEnd ?? b.date;
			const clampedStart = b.date >= firstDay ? b.date : firstDay;
			const clampedEnd = bookingEnd <= lastDay ? bookingEnd : lastDay;
			const startCol = weekDates.indexOf(clampedStart);
			const endCol = weekDates.indexOf(clampedEnd);
			const span = endCol - startCol + 1;

			let row = rowEndCols.findIndex(end => end < startCol);
			if (row === -1) { row = rowEndCols.length; rowEndCols.push(endCol); }
			else { rowEndCols[row] = endCol; }

			return { booking: b, startCol, span, row };
		});
	}

	// Percentage-based inline style for a spanning pill
	function spanStyle(startCol: number, span: number, row: number): string {
		const DAY_NUM_H = 22; // px — height of day number row
		const PILL_H = 18;   // px — height of each pill
		const PILL_GAP = 2;  // px — gap between pill rows
		const left = (startCol / 7) * 100;
		const width = (span / 7) * 100;
		const top = DAY_NUM_H + row * (PILL_H + PILL_GAP);
		return `position:absolute; left:calc(${left}% + 2px); width:calc(${width}% - 4px); top:${top}px; height:${PILL_H}px; z-index:10;`;
	}

	// Padding-top for single-day chips (clears the spanning pills)
	function cellPt(maxRows: number): string {
		const DAY_NUM_H = 22;
		const PILL_H = 18;
		const PILL_GAP = 2;
		const pt = maxRows > 0 ? DAY_NUM_H + maxRows * (PILL_H + PILL_GAP) : DAY_NUM_H;
		return `padding-top:${pt}px;`;
	}

	// Rounded corners: pill starts/ends this week or continues across boundary
	function pillRounded(booking: BookingSummary, weekDates: (string | null)[]): string {
		const validDates = weekDates.filter(Boolean) as string[];
		const startsHere = booking.date >= validDates[0];
		const endsHere = (booking.dateEnd ?? booking.date) <= validDates[validDates.length - 1];
		if (startsHere && endsHere) return 'rounded';
		if (startsHere) return 'rounded-l rounded-r-none';
		if (endsHere) return 'rounded-r rounded-l-none';
		return 'rounded-none';
	}

	function pillClasses(booking: BookingSummary): string {
		const c = getServiceColor(booking.serviceColor ?? '');
		const opacity = booking.status === 'pending' ? 'opacity-60' : '';
		return `${c.bg} ${c.text} ${opacity}`;
	}
	function statusDot(status: string): string {
		return status === 'confirmed' ? '●' : '○';
	}

	// ── Day view ──────────────────────────────────────────────────────────────
	const SLOT_OPTIONS = [15, 30, 60] as const;
	let slotMinutes = $state(60);
	const START_HOUR = 7;
	const END_HOUR = 22;

	const daySlots = $derived(
		Array.from({ length: ((END_HOUR - START_HOUR) * 60) / slotMinutes }, (_, i) => {
			const totalMins = START_HOUR * 60 + i * slotMinutes;
			const h = Math.floor(totalMins / 60);
			const m = totalMins % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		})
	);

	function toSlotKey(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const totalMins = h * 60 + (m ?? 0);
		const snapped = Math.floor(totalMins / slotMinutes) * slotMinutes;
		return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
	}

	// Day view: sessions take priority for has_sessions services.
	// Non-session bookings (rentals, accommodation, products) still show as bookings.
	const daySessionSlots = $derived(() => {
		const map: Record<string, typeof data.daySessions> = {};
		for (const s of data.daySessions) {
			if (s.time && s.status !== 'cancelled') {
				const key = toSlotKey(s.time);
				(map[key] ??= []).push(s);
			}
		}
		return map;
	});

	// Slots "spanned" by sessions that started in previous slots.
	// Maps slot → array (one entry per concurrent session spanning that slot).
	const daySessionSpanned = $derived(() => {
		const map: Record<string, { sessionId: string; serviceColor: string | null }[]> = {};
		for (const s of data.daySessions) {
			if (!s.time || s.status === 'cancelled') continue;
			const [sh, sm] = s.time.split(':').map(Number);
			const startMins = sh * 60 + sm;
			const dur = s.effectiveDuration ?? 60;
			let mins = startMins + slotMinutes;
			while (mins < startMins + dur) {
				const h = Math.floor(mins / 60);
				const m = mins % 60;
				const slot = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
				(map[slot] ??= []).push({ sessionId: s.id, serviceColor: s.serviceColor });
				mins += slotMinutes;
			}
		}
		return map;
	});

	// Height style for a session card based on its duration
	function sessionCardStyle(dur: number): string {
		const slots = Math.max(1, Math.ceil(dur / slotMinutes));
		return `min-height: ${slots * 3}rem`;
	}

	function fmtEur(n: number): string {
		return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`;
	}

	// Day summary totals (scheduled sessions only)
	const daySummary = $derived(() => {
		const scheduled = data.daySessions.filter(s => s.status === 'scheduled');
		const totalDue = scheduled.reduce((acc, s) => acc + s.totalAmountDue, 0);
		const totalPaid = scheduled.reduce((acc, s) => acc + s.totalAmountPaid, 0);
		return { count: scheduled.length, totalDue, totalPaid, pending: totalDue - totalPaid };
	});

	// Unscheduled sessions (no time) + non-session bookings without time
	const dayUnscheduledSessions = $derived(
		data.daySessions.filter(s => s.status === 'unscheduled')
	);
	const dayNonSessionBookings = $derived(
		data.bookings.filter(b =>
			b.status !== 'cancelled' && !b.serviceHasSessions && (!b.time || b.isFlexible)
		)
	);
	// Camp bookings active on this day with no sessions scheduled today
	const campBanners = $derived(
		data.view === 'day'
			? data.bookings.filter(b =>
				b.serviceHasRoster && b.serviceHasDateRange && b.dateEnd &&
				b.status !== 'cancelled' &&
				!data.daySessions.some(s => s.bookingIds.includes(b.id))
			  )
			: []
	);
	function campDayNumber(camp: BookingSummary, date: string): number {
		const start = new Date(camp.date + 'T00:00:00');
		const current = new Date(date + 'T00:00:00');
		return Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
	}
	const daySlottedNonSessionBookings = $derived(() => {
		const map: Record<string, BookingSummary[]> = {};
		for (const b of data.bookings) {
			if (b.time && b.status !== 'cancelled' && !b.serviceHasSessions) {
				const key = toSlotKey(b.time);
				(map[key] ??= []).push(b);
			}
		}
		return map;
	});
	// Cancelled — collapsed at bottom
	const dayCancelled = $derived(
		data.bookings.filter(b => b.status === 'cancelled')
	);

	function dayBookingBg(booking: BookingSummary): string {
		const c = getServiceColor(booking.serviceColor ?? '');
		return `${c.border} ${c.bg} ${booking.isFlexible ? 'border-dashed' : 'border-solid'}`;
	}
	function dayStatusText(booking: BookingSummary): string {
		return getServiceColor(booking.serviceColor ?? '').text;
	}
	// Context-aware subtitle: camp shows enrollment, accommodation shows unit, lesson shows instructor
	function bookingSubtitle(booking: BookingSummary): string {
		if (booking.serviceHasRoster) {
			const max = booking.serviceMaxCapacity;
			return max != null
				? `${booking.clientCount}/${max} enrolled`
				: `${booking.clientCount} enrolled`;
		}
		if (booking.serviceHasInventoryUnits) {
			return booking.allocationSummary ?? 'Accommodation';
		}
		return booking.instructorName ?? 'No instructor';
	}
</script>

<div class="flex h-full flex-col overflow-hidden">

	<!-- Header -->
	<div class="page-header">
		<!-- Navigation: prev/title/next — shrinks to fit remaining space -->
		<div class="flex min-w-0 flex-1 items-center gap-1">
			{#if data.view === 'month'}
				<button onclick={prevMonth} class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">‹</button>
				<h1 class="min-w-0 flex-1 text-center text-sm font-semibold text-navy">{monthName} {data.year}</h1>
				<button onclick={nextMonth} class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">›</button>
			{:else if data.view === 'week'}
				<a href="/calendar?view=week&week={data.prevWeek}" class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">‹</a>
				<h1 class="min-w-0 flex-1 truncate text-center text-sm font-semibold text-navy">{weekLabel()}</h1>
				<a href="/calendar?view=week&week={data.nextWeek}" class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">›</a>
			{:else}
				<a href="/calendar?view=day&date={data.prevDay}" class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">‹</a>
				<h1 class="min-w-0 flex-1 truncate text-center text-sm font-semibold text-navy">
					<!-- Short on mobile, full on sm+ -->
					<span class="sm:hidden">{new Date(data.dayDate + 'T00:00:00').toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
					<span class="hidden sm:inline">{data.dayLabel}</span>
				</h1>
				<a href="/calendar?view=day&date={data.nextDay}" class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base">›</a>
			{/if}
		</div>

		<!-- Right: legend (month/week) + view toggle -->
		<div class="ml-2 flex shrink-0 items-center gap-2">
			{#if data.view !== 'day'}
				<span class="hidden items-center gap-2 text-[10px] text-muted sm:flex">
					<span>{m.calendar_confirmed()}</span>
					<span>{m.calendar_pending()}</span>
				</span>
			{/if}
			<div class="flex overflow-hidden rounded-lg bg-slate-100 p-0.5">
				<button onclick={() => setView('month')} class="rounded-md px-2 py-1 text-xs font-semibold transition-colors {data.view === 'month' ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">
					<span class="sm:hidden">M</span><span class="hidden sm:inline">{m.calendar_month()}</span>
				</button>
				<button onclick={() => setView('week')}  class="rounded-md px-2 py-1 text-xs font-semibold transition-colors {data.view === 'week'  ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">
					<span class="sm:hidden">W</span><span class="hidden sm:inline">{m.calendar_week()}</span>
				</button>
				<button onclick={() => setView('day')}   class="rounded-md px-2 py-1 text-xs font-semibold transition-colors {data.view === 'day'   ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">
					<span class="sm:hidden">D</span><span class="hidden sm:inline">{m.calendar_day()}</span>
				</button>
			</div>
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

			<!-- Weeks -->
			<div class="flex flex-1 flex-col overflow-hidden">
				{#each weeks() as weekDates}
					{@const layout = weekSpanLayout(weekDates)}
					{@const maxRows = layout.length > 0 ? Math.max(...layout.map(l => l.row)) + 1 : 0}

					<div class="relative flex-1 border-b border-border/60 last:border-b-0">

						<!-- Background + day numbers + single-day chips — one cell per column -->
						<div class="absolute inset-0 grid grid-cols-7">
							{#each weekDates as dateStr}
								{#if dateStr === null}
									<div class="border-r border-border/40 bg-sand/40 last:border-r-0"></div>
								{:else}
									{@const isToday = dateStr === today}
									<div class="group relative flex flex-col overflow-hidden border-r border-border/40 last:border-r-0
										{isToday ? 'bg-ocean/5' : 'bg-surface'}">

										<!-- Full-cell link (behind everything) -->
										<a href="/calendar?view=day&date={dateStr}" class="absolute inset-0 z-0" aria-label="Open {dateStr}"></a>

										<!-- Day number — clickable link to day view -->
										<div class="relative z-10 flex justify-end p-0.5">
											<a href="/calendar?view=day&date={dateStr}"
												class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors
												{isToday ? 'bg-ocean text-white' : 'text-gray-500 hover:bg-ocean/15 hover:text-ocean'}">
												{dateStr.slice(-2).replace(/^0/, '')}
											</a>
										</div>

										<!-- Events banner + session count dot -->
										<div class="relative z-10 flex flex-col items-center gap-px overflow-hidden px-0.5 pb-0.5 pt-1">
											<!-- surf events -->
											{#each data.events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr) as event}
												<a href="/events/{event.id}"
													class="block w-full truncate rounded bg-confirmed/20 px-1 py-px text-[10px] font-medium leading-tight text-green-800 hover:bg-confirmed/35">
													<span class="hidden sm:inline">🏕️ {event.title}</span>
													<span class="sm:hidden">🏕️</span>
												</a>
											{/each}
											<!-- session compact cards -->
											{#each data.rangedSessions.filter(s => s.date === dateStr).slice(0, 3) as session}
												<SessionCard {session} size="compact" />
											{/each}
											{#if data.rangedSessions.filter(s => s.date === dateStr).length > 3}
												<span class="text-[9px] text-muted leading-none px-1">
													+{data.rangedSessions.filter(s => s.date === dateStr).length - 3}
												</span>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>

						<!-- Events spanning pills (multi-day events only — bookings replaced by session dots) -->
						{#each layout as { booking, startCol, span, row }}
							{@const startsHere = booking.date >= (weekDates.find(d => d !== null) ?? '')}
							{#if booking.serviceHasRoster}
								<a
									href="/bookings/{booking.id}"
									style={spanStyle(startCol, span, row)}
									class="truncate px-1.5 text-[10px] font-medium leading-none flex items-center hover:brightness-95 {pillRounded(booking, weekDates)} {pillClasses(booking)}"
								>
									{#if startsHere}
										<Tent size={11} class="inline mr-0.5" />{booking.serviceName}
										{#if booking.serviceMaxCapacity != null}
											<span class="ml-1 opacity-70">({booking.clientCount}/{booking.serviceMaxCapacity})</span>
										{:else}
											<span class="ml-1 opacity-70">({booking.clientCount})</span>
										{/if}
									{:else}
										&nbsp;
									{/if}
								</a>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ─── WEEK VIEW ─── -->
	{#if data.view === 'week'}
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Weekday column headers -->
			<div class="grid shrink-0 grid-cols-7 border-b border-border bg-sand">
				{#each data.weekDays as dateStr}
					{@const isToday = dateStr === today}
					{@const d = new Date(dateStr + 'T00:00:00')}
					<a href="/calendar?view=day&date={dateStr}"
						class="flex flex-col items-center py-2 text-center transition-colors hover:bg-ocean/5">
						<span class="text-[10px] font-semibold uppercase tracking-wide text-muted">
							{d.toLocaleDateString(getLocale(), { weekday: 'short' })}
						</span>
						<span class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
							{isToday ? 'bg-ocean text-white' : 'text-navy'}">
							{d.getDate()}
						</span>
					</a>
				{/each}
			</div>

			<!-- Day columns with sessions -->
			<div class="flex flex-1 overflow-y-auto">
				<div class="grid min-h-full w-full grid-cols-7 divide-x divide-border/40">
					{#each data.weekDays as weekDay}
						{@const isToday = weekDay === today}
						{@const daySessions = data.rangedSessions.filter(s => s.date === weekDay)}
						<div class="flex flex-col gap-1 p-1 {isToday ? 'bg-ocean/5' : 'bg-surface'}">
							{#if daySessions.length === 0}
								<div class="flex flex-1 items-center justify-center">
									<span class="text-[10px] text-border">—</span>
								</div>
							{:else}
								{#each daySessions as s}
									<SessionCard session={s} size="medium" />
								{/each}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- ─── DAY VIEW ─── -->
	{#if data.view === 'day'}
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Slot granularity control — lives in the grid, not the header -->
			<div class="flex shrink-0 items-center justify-end gap-2 border-b border-border bg-surface/60 px-4 py-1.5">
				<span class="text-[10px] text-muted">{m.calendar_slot_size()}</span>
				<div class="flex overflow-hidden rounded-md bg-slate-100 p-0.5">
					{#each SLOT_OPTIONS as opt}
						<button type="button" onclick={() => slotMinutes = opt}
							class="rounded px-2 py-0.5 text-[10px] font-semibold transition-colors {slotMinutes === opt ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">
							{opt}m
						</button>
					{/each}
				</div>
			</div>
			<div class="flex-1 overflow-y-auto">
				<!-- Day summary bar -->
				{#if daySummary().count > 0}
					<div class="flex items-center gap-4 border-b border-border bg-sand/40 px-4 py-2">
						<span class="text-xs font-semibold text-navy">{daySummary().count} sesiones</span>
						<span class="text-xs text-muted">·</span>
						<span class="text-xs text-gray-700">{fmtEur(daySummary().totalDue)} facturado</span>
						{#if daySummary().totalPaid > 0}
							<span class="text-xs text-muted">·</span>
							<span class="text-xs font-medium text-green-700">{fmtEur(daySummary().totalPaid)} cobrado</span>
						{/if}
						{#if daySummary().pending > 0.01}
							<span class="text-xs muted">·</span>
							<span class="text-xs font-semibold text-amber-700">⚠ {fmtEur(daySummary().pending)} pendiente</span>
						{:else if daySummary().totalDue > 0}
							<span class="text-xs muted">·</span>
							<span class="text-xs font-semibold text-green-700">✓ Todo cobrado</span>
						{/if}
					</div>
				{/if}

				{#if data.inventoryShortages.length > 0}
					<a
						href="/inventory"
						class="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 hover:bg-amber-100"
					>
						<span class="font-semibold">⚠ Inventario insuficiente</span>
						<span class="text-amber-600">·</span>
						<span>{data.inventoryShortages.length} tipo{data.inventoryShortages.length > 1 ? 's' : ''} con déficit hoy</span>
						<span class="ml-auto text-amber-500">→ Ver inventario</span>
					</a>
				{/if}

				<!-- Events covering this day -->
				{#each data.events as event}
					<a href="/events/{event.id}" class="flex items-center gap-2 border-b border-confirmed/20 bg-confirmed/10 px-4 py-2.5">
						<div>
							<p class="text-sm font-semibold text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</a>
				{/each}

				<!-- Camp active today but no sessions scheduled -->
				{#each campBanners as camp}
					{@const c = getServiceColor(camp.serviceColor ?? '')}
					<div class="flex items-center justify-between border-b border-border/50 px-4 py-2.5 {c.bg}/20 border-l-4 {c.border}">
						<div>
							<p class="text-xs font-semibold text-gray-800"><Tent size={13} class="inline mr-0.5" />{camp.serviceName} — Day {campDayNumber(camp, data.dayDate)}</p>
							<p class="text-xs text-muted">{camp.date} → {camp.dateEnd} · {camp.clientCount} enrolled · {m.calendar_no_sessions()}</p>
						</div>
						<a href="/bookings/{camp.id}"
							class="rounded-full bg-ocean/15 px-2.5 py-1 text-[10px] font-semibold text-ocean hover:bg-ocean/25 transition-colors">
							{m.calendar_add_session()}
						</a>
					</div>
				{/each}

				<!-- Unscheduled sessions + non-session flexible bookings -->
				{#if dayUnscheduledSessions.length > 0 || dayNonSessionBookings.length > 0}
					<div class="border-b border-border bg-pending/5 px-4 py-2">
						<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{m.calendar_needs_scheduling()}</p>
						<div class="space-y-1.5">
							{#each dayUnscheduledSessions as session}
								{@const isAssigning = assigningSessionId === session.id}
								<div class="rounded-lg border-l-4 border-dashed border-amber-300 bg-surface ring-1 ring-border overflow-hidden">
									<div class="flex items-center justify-between px-3 py-2">
										<div class="min-w-0">
											<p class="text-sm font-medium text-gray-800">{session.serviceName}</p>
											<p class="text-xs text-muted">
												{session.participantNames.length > 0 ? session.participantNames.join(', ') : 'No participants'}
											</p>
										</div>
										<button type="button"
											onclick={() => assigningSessionId = isAssigning ? null : session.id}
											class="ml-2 shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-200 transition-colors">
											{isAssigning ? 'Cancel' : 'Assign'}
										</button>
									</div>
									{#if isAssigning}
										<form method="post" action="?/assignSession"
											use:enhance={() => () => { assigningSessionId = null; }}
											class="border-t border-amber-100 bg-amber-50/40 px-3 py-2.5 space-y-2">
											<input type="hidden" name="sessionId" value={session.id} />
											<div class="grid grid-cols-2 gap-2">
												<div>
													<label class="text-[10px] font-medium text-muted uppercase tracking-wide">{m.calendar_time()}</label>
													<input name="time" type="time" required autofocus
														bind:value={editFormTime}
														class="mt-0.5 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
												</div>
												<div>
													<label class="text-[10px] font-medium text-muted uppercase tracking-wide">{m.calendar_duration()}</label>
													<input name="duration" type="number" min="15" step="15"
														bind:value={editFormDuration}
														class="mt-0.5 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
												</div>
											</div>
											<div>
												<label class="text-[10px] font-medium text-muted uppercase tracking-wide">{m.common_notes()}</label>
												<input name="notes" placeholder={m.calendar_spot_group()}
													value={session.notes ?? ''}
													class="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
											</div>
											{#if data.instructors.length > 0}
												<div>
													<label class="text-[10px] font-medium text-muted uppercase tracking-wide mb-1 block">{m.calendar_instructors()}</label>
													<div class="space-y-1.5">
														{#each data.instructors as instructor}
															{@const conflicts = editConflicts[instructor.id] ?? []}
															<label class="flex items-start gap-2 cursor-pointer">
																<input type="checkbox" name="instructorId" value={instructor.id}
																	checked={session.instructors.some(i => i.instructorId === instructor.id)}
																	class="mt-0.5 h-3.5 w-3.5 accent-ocean shrink-0" />
																<div class="min-w-0">
																	<span class="text-xs text-gray-700">{instructor.name}</span>
																	{#if conflicts.length > 0}
																		<p class="text-[10px] text-amber-600 font-medium">
																			⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'session'}
																			{conflicts[0].bookingStatus === 'pending' ? '(pending)' : ''}
																		</p>
																	{/if}
																</div>
															</label>
														{/each}
													</div>
												</div>
											{/if}
											<div class="flex gap-2 pt-1">
												<button type="submit" class="flex-1 rounded-lg bg-ocean py-2 text-xs font-semibold text-white hover:bg-ocean/90">{m.calendar_schedule()}</button>
												<a href="/bookings/{session.bookingId}" class="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-sand">{m.calendar_view_booking()}</a>
											</div>
										</form>
									{/if}
								</div>
							{/each}
							{#each dayNonSessionBookings as booking}
								<a href="/bookings/{booking.id}"
									class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {dayBookingBg(booking)}">
									<div>
										<p class="text-sm font-medium text-gray-800">
											{booking.serviceName}
											{#if booking.firstClientName}<span class="font-normal text-muted"> · {booking.firstClientName}</span>{/if}
										</p>
										<p class="text-xs text-muted">{bookingSubtitle(booking)}</p>
									</div>
									<span class="text-xs {dayStatusText(booking)}">{booking.status}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Time grid -->
				<div class="divide-y divide-border/50">
					{#each daySlots as slot}
						{@const sessionsHere = daySessionSlots()[slot] ?? []}
						{@const nonSessionHere = daySlottedNonSessionBookings()[slot] ?? []}
						{@const spannedList = daySessionSpanned()[slot] ?? []}
						{@const anyHere = sessionsHere.length > 0 || nonSessionHere.length > 0}
						{@const isHour = slot.endsWith(':00')}
						<div class="flex min-h-12 gap-0 {anyHere || spannedList.length > 0 ? '' : 'hover:bg-sand/60'}">
							<div class="w-14 shrink-0 border-r border-border/50 px-2 pt-1 text-right">
								{#if isHour}
									<span class="text-[11px] font-medium text-muted">{slot}</span>
								{:else}
									<span class="text-[9px] text-border">{slot}</span>
								{/if}
							</div>
							<div class="min-w-0 flex-1 px-2 py-1">
								{#if spannedList.length > 0 && sessionsHere.length === 0}
									<!-- Continuation bars — one per session spanning this slot -->
									<div class="flex h-full gap-0.5">
										{#each spannedList as span}
											{@const sc = getServiceColor(span.serviceColor ?? '')}
											<div class="flex-1 rounded-r border-l-2 {sc.border} opacity-25"></div>
										{/each}
									</div>
								{:else if sessionsHere.length > 0}
									<!-- Sessions: side-by-side when concurrent, stacked when single -->
									<div class="flex gap-1.5 {sessionsHere.length > 1 ? 'items-start' : ''}">
										{#each sessionsHere as session}
											{@const sc = getServiceColor(session.serviceColor ?? '')}
											{@const isEditing = assigningSessionId === session.id}
											{@const dur = session.effectiveDuration ?? 60}
											{@const endTime = session.time ? addMinutesToTime(session.time.slice(0,5), dur) : null}
											<div class="min-w-0 flex-1 rounded-lg border-l-4 ring-1 ring-border overflow-hidden {sc.border} {sc.bg}"
												style={sessionCardStyle(dur)}>
												<div class="flex items-start justify-between px-2.5 py-2">
													<a href="/bookings/{session.bookingId}" class="min-w-0 flex-1 block">
														<p class="text-xs font-bold text-gray-900 tabular-nums">
															{session.time?.slice(0,5)} – {endTime}
														</p>
														<p class="truncate text-xs font-medium text-gray-800">{session.serviceName}</p>
														<p class="truncate text-[10px] text-muted">
															{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || '—'}
														</p>
														{#if session.participantNames.length > 0}
															<p class="truncate text-[10px] text-muted">{session.participantNames[0]}{session.participantNames.length > 1 ? ` +${session.participantNames.length - 1}` : ''}</p>
														{/if}
														{#if session.totalAmountDue > 0}
															{@const pending = session.totalAmountDue - session.totalAmountPaid}
															{#if pending <= 0.01}
																<p class="text-[10px] font-semibold text-green-700">✓ {fmtEur(session.totalAmountDue)}</p>
															{:else if session.totalAmountPaid > 0.01}
																<p class="text-[10px] font-semibold text-amber-700">⚠ {fmtEur(pending)} pend. / {fmtEur(session.totalAmountDue)}</p>
															{:else}
																<p class="text-[10px] font-medium text-red-600">⚠ {fmtEur(session.totalAmountDue)} sin cobrar</p>
															{/if}
														{/if}
													</a>
													<button type="button"
														onclick={() => assigningSessionId = isEditing ? null : session.id}
														class="ml-1 shrink-0 rounded p-0.5 text-[11px] text-muted hover:bg-black/10 transition-colors"
														aria-label="Edit session">
														{isEditing ? '▲' : '✎'}
													</button>
												</div>
												{#if isEditing}
													<form method="post" action="?/assignSession"
														use:enhance={() => () => { assigningSessionId = null; }}
														class="border-t border-border/40 bg-white/70 px-3 py-2.5 space-y-2">
														<input type="hidden" name="sessionId" value={session.id} />
														<div class="grid grid-cols-2 gap-2">
															<div>
																<label class="text-[10px] font-medium text-muted uppercase tracking-wide">Start</label>
																<input name="time" type="time" autofocus
																	bind:value={editFormTime}
																	class="mt-0.5 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
															</div>
															<div>
																<label class="text-[10px] font-medium text-muted uppercase tracking-wide">{m.calendar_duration()}</label>
																<input name="duration" type="number" min="15" step="15"
																	bind:value={editFormDuration}
																	class="mt-0.5 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
															</div>
														</div>
														<div>
															<label class="text-[10px] font-medium text-muted uppercase tracking-wide">{m.common_notes()}</label>
															<input name="notes"
																value={session.notes ?? ''}
																class="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
														</div>
														{#if data.instructors.length > 0}
															<div>
																<label class="text-[10px] font-medium text-muted uppercase tracking-wide mb-1 block">{m.calendar_instructors()}</label>
																<div class="space-y-1.5">
																	{#each data.instructors as instructor}
																		{@const conflicts = editConflicts[instructor.id] ?? []}
																		<label class="flex items-start gap-2 cursor-pointer">
																			<input type="checkbox" name="instructorId" value={instructor.id}
																				checked={session.instructors.some(i => i.instructorId === instructor.id)}
																				class="mt-0.5 h-3.5 w-3.5 accent-ocean shrink-0" />
																			<div class="min-w-0">
																				<span class="text-xs text-gray-700">{instructor.name}</span>
																				{#if conflicts.length > 0}
																					<p class="text-[10px] text-amber-600 font-medium">
																						⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'session'}
																						{conflicts[0].bookingStatus === 'pending' ? '(pending)' : ''}
																					</p>
																				{/if}
																			</div>
																		</label>
																	{/each}
																</div>
															</div>
														{/if}
														<div class="flex gap-2 pt-1">
															<button type="submit" class="flex-1 rounded-lg bg-ocean py-2 text-xs font-semibold text-white hover:bg-ocean/90">{m.common_save()}</button>
														</div>
													</form>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
								{#each nonSessionHere as booking}
									<a href="/bookings/{booking.id}"
										class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {dayBookingBg(booking)}">
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-gray-800">
												{booking.time ? booking.time.slice(0, 5) + ' ' : ''}{booking.serviceName}
											</p>
											<p class="text-xs text-muted">{bookingSubtitle(booking)}</p>
										</div>
										<span class="ml-2 shrink-0 text-xs {dayStatusText(booking)}">{booking.status}</span>
									</a>
								{/each}
								{#if !anyHere && isHour}
									<a href="/bookings/new?date={data.dayDate}&time={slot}"
										class="block h-full w-full text-[10px] text-transparent hover:text-muted/60">+ {slot}</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Cancelled (collapsed) -->
				{#if dayCancelled.length > 0}
					<details class="border-t border-border/50">
						<summary class="cursor-pointer px-4 py-2 text-xs text-muted hover:text-gray-600">
							Cancelled ({dayCancelled.length})
						</summary>
						<div class="space-y-1 px-4 pb-3">
							{#each dayCancelled as booking}
								<a href="/bookings/{booking.id}"
									class="flex items-center justify-between rounded-lg border border-border bg-surface p-3 opacity-50">
									<p class="text-sm text-gray-500 line-through">{booking.serviceName}</p>
									<span class="text-xs text-muted">cancelled</span>
								</a>
							{/each}
						</div>
					</details>
				{/if}

				<div class="h-20"></div>
			</div>
		</div>
	{/if}
</div>

<a href="/bookings/new{data.view === 'day' ? '?date=' + data.dayDate : ''}"
	class="bottom-nav fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-white shadow-lg shadow-ocean/30 transition-all hover:bg-blue-700 hover:shadow-ocean/40 active:scale-95"
	aria-label="New booking">
	<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
</a>
