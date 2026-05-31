<script lang="ts">
	import { goto } from '$app/navigation';
	import { groupBookingsByDate, getDaysInMonth } from '$lib/features/calendar/utils';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';
	import type { BookingSummary } from '$lib/features/bookings/types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupBookingsByDate(data.bookings));
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
		new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })
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
			d.toLocaleDateString('default', short
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

	function chipClasses(booking: BookingSummary): string {
		const c = getServiceColor(booking.serviceColor ?? '');
		const opacity = booking.status === 'pending' ? 'opacity-60' : '';
		return `${c.bg} ${c.text} ${opacity}`;
	}
	function pillClasses(booking: BookingSummary): string {
		const c = getServiceColor(booking.serviceColor ?? '');
		const opacity = booking.status === 'pending' ? 'opacity-60' : '';
		return `${c.bg} ${c.text} ${opacity}`;
	}
	function statusDot(status: string): string {
		return status === 'confirmed' ? '●' : '○';
	}

	function weekChipClasses(booking: BookingSummary): string {
		return chipClasses(booking);
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

	const daySlottedBookings = $derived(() => {
		const map: Record<string, BookingSummary[]> = {};
		for (const b of data.bookings) {
			if (b.time && b.status !== 'cancelled') {
				const key = toSlotKey(b.time);
				(map[key] ??= []).push(b);
			}
		}
		return map;
	});

	// Non-cancelled unscheduled (no time OR flexible)
	const dayUnscheduled = $derived(
		data.bookings.filter(b => b.status !== 'cancelled' && (!b.time || b.isFlexible))
	);
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
			return booking.accommodationUnitName ?? 'Accommodation';
		}
		return booking.instructorName ?? 'No instructor';
	}
</script>

<div class="flex h-full flex-col overflow-hidden">

	<!-- Header -->
	<div class="page-header">
		<div class="flex items-center gap-1">
			{#if data.view === 'month'}
				<button onclick={prevMonth} class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">‹</button>
				<h1 class="w-36 text-center text-sm font-semibold text-navy">{monthName} {data.year}</h1>
				<button onclick={nextMonth} class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">›</button>
			{:else if data.view === 'week'}
				<a href="/calendar?view=week&week={data.prevWeek}" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">‹</a>
				<h1 class="w-44 text-center text-sm font-semibold text-navy">{weekLabel()}</h1>
				<a href="/calendar?view=week&week={data.nextWeek}" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">›</a>
			{:else}
				<a href="/calendar?view=day&date={data.prevDay}" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">‹</a>
				<h1 class="max-w-52 truncate text-center text-sm font-semibold text-navy">{data.dayLabel}</h1>
				<a href="/calendar?view=day&date={data.nextDay}" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0 text-base">›</a>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if data.view === 'day'}
				<select bind:value={slotMinutes}
					class="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-slate-700 focus:border-ocean focus:outline-none">
					{#each SLOT_OPTIONS as opt}
						<option value={opt}>{opt} min</option>
					{/each}
				</select>
			{:else}
				<span class="hidden items-center gap-2 text-[10px] text-muted sm:flex">
					<span>● Confirmed</span>
					<span>○ Pending</span>
				</span>
			{/if}
			<div class="flex overflow-hidden rounded-lg bg-slate-100 p-0.5">
				<button onclick={() => setView('month')} class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors {data.view === 'month' ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">Month</button>
				<button onclick={() => setView('week')}  class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors {data.view === 'week'  ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">Week</button>
				<button onclick={() => setView('day')}   class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors {data.view === 'day'   ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-slate-700'}">Day</button>
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
									{@const dayChips = (singleGrouped[dateStr] ?? []).slice(0, 3)}
									{@const overflow = (singleGrouped[dateStr] ?? []).length - dayChips.length}

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

										<!-- Events + single-day chips (padded to clear spanning pills) -->
										<div class="relative z-10 flex flex-col gap-px overflow-hidden px-0.5 pb-0.5" style={cellPt(maxRows)}>
											<!-- surf events -->
											{#each data.events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr) as event}
												<a href="/events/{event.id}"
													class="block truncate rounded bg-confirmed/20 px-1 py-px text-[10px] font-medium leading-tight text-green-800 hover:bg-confirmed/35">
													<span class="hidden sm:inline">🏕️ {event.title}</span>
													<span class="sm:hidden">🏕️</span>
												</a>
											{/each}
											<!-- single-day booking chips -->
											{#each dayChips as booking}
												<a href="/bookings/{booking.id}"
													class="block truncate rounded px-1 py-px text-[10px] leading-tight hover:brightness-95 {chipClasses(booking)}">
													<span class="hidden sm:inline">
														{statusDot(booking.status)} {booking.time ? booking.time.slice(0,5) + ' ' : ''}{booking.serviceName}{booking.firstClientName ? ' · ' + booking.firstClientName : ''}
													</span>
													<span class="sm:hidden" style="color:inherit">{statusDot(booking.status)}</span>
												</a>
											{/each}
											{#if overflow > 0}
												<a href="/calendar?view=day&date={dateStr}" class="pl-1 text-[10px] text-muted hover:text-ocean">+{overflow} more</a>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>

						<!-- Multi-day spanning pills — absolutely positioned over the grid -->
						{#each layout as { booking, startCol, span, row }}
							{@const startsHere = booking.date >= (weekDates.find(d => d !== null) ?? '')}
							<a
								href="/bookings/{booking.id}"
								style={spanStyle(startCol, span, row)}
								class="truncate px-1.5 text-[10px] font-medium leading-none flex items-center hover:brightness-95 {pillRounded(booking, weekDates)} {pillClasses(booking)}"
							>
								{#if startsHere}
									🏕️ {booking.serviceName}
									{#if booking.serviceMaxCapacity != null}
										<span class="ml-1 opacity-70">({booking.clientCount}/{booking.serviceMaxCapacity})</span>
									{:else}
										<span class="ml-1 opacity-70">({booking.clientCount})</span>
									{/if}
								{:else}
									&nbsp;
								{/if}
							</a>
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
							{d.toLocaleDateString('default', { weekday: 'short' })}
						</span>
						<span class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
							{isToday ? 'bg-ocean text-white' : 'text-navy'}">
							{d.getDate()}
						</span>
					</a>
				{/each}
			</div>

			<!-- Day columns with bookings -->
			<div class="flex flex-1 overflow-y-auto">
				<div class="grid min-h-full w-full grid-cols-7 divide-x divide-border/40">
					{#each data.weekDays as dateStr}
						{@const isToday = dateStr === today}
						{@const dayBookings = weekBookingsByDate[dateStr] ?? []}
						<div class="flex flex-col gap-1 p-1 {isToday ? 'bg-ocean/5' : 'bg-surface'}">
							{#if dayBookings.length === 0}
								<div class="flex flex-1 items-center justify-center">
									<span class="text-[10px] text-border">—</span>
								</div>
							{:else}
								{#each dayBookings as booking}
									<a href="/bookings/{booking.id}"
										class="block rounded px-1.5 py-1 text-[10px] leading-tight hover:brightness-95 {weekChipClasses(booking)}">
										<span class="block font-semibold">
											{statusDot(booking.status)} {booking.time ? booking.time.slice(0, 5) : '—'}
										</span>
										<span class="block truncate">{booking.serviceName}</span>
										{#if booking.firstClientName}
											<span class="block truncate opacity-70">{booking.firstClientName}</span>
										{/if}
									</a>
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
			<div class="flex-1 overflow-y-auto">
				<!-- Events covering this day -->
				{#each data.events as event}
					<a href="/events/{event.id}" class="flex items-center gap-2 border-b border-confirmed/20 bg-confirmed/10 px-4 py-2.5">
						<div>
							<p class="text-sm font-semibold text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</a>
				{/each}

				<!-- Unscheduled / flexible (non-cancelled) -->
				{#if dayUnscheduled.length > 0}
					<div class="border-b border-border bg-pending/5 px-4 py-2">
						<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">⚡ Unscheduled / Flexible</p>
						<div class="space-y-1.5">
							{#each dayUnscheduled as booking}
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
						{@const bookingsHere = daySlottedBookings()[slot] ?? []}
						{@const isHour = slot.endsWith(':00')}
						<div class="flex min-h-12 gap-0 {bookingsHere.length > 0 ? '' : 'hover:bg-sand/60'}">
							<div class="w-14 shrink-0 border-r border-border/50 px-2 pt-1 text-right">
								{#if isHour}
									<span class="text-[11px] font-medium text-muted">{slot}</span>
								{:else}
									<span class="text-[9px] text-border">{slot}</span>
								{/if}
							</div>
							<div class="flex-1 px-2 py-1 {bookingsHere.length > 0 ? 'space-y-1' : ''}">
								{#each bookingsHere as booking}
									<a href="/bookings/{booking.id}"
										class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {dayBookingBg(booking)}">
										<div class="min-w-0">
											<p class="truncate text-sm font-medium text-gray-800">
												{booking.time ? booking.time.slice(0, 5) + ' ' : ''}{booking.serviceName}
												{#if booking.firstClientName}
													<span class="font-normal text-muted"> · {booking.firstClientName}{booking.clientCount > 1 ? ` +${booking.clientCount - 1}` : ''}</span>
												{/if}
											</p>
											<p class="text-xs text-muted">
												{bookingSubtitle(booking)}
												{#if booking.isFlexible}<span class="text-flexible"> ⚡</span>{/if}
											</p>
										</div>
										<span class="ml-2 shrink-0 text-xs {dayStatusText(booking)}">{booking.status}</span>
									</a>
								{/each}
								{#if bookingsHere.length === 0 && isHour}
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
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-white shadow-lg shadow-ocean/30 transition-all hover:bg-blue-700 hover:shadow-ocean/40 active:scale-95 md:bottom-6"
	aria-label="New booking">
	<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
</a>
