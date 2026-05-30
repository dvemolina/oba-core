<script lang="ts">
	import type { PageData } from './$types';
	import { getServiceColor } from '$lib/features/services/colors';

	let { data }: { data: PageData } = $props();

	// ── Date label ────────────────────────────────────────────────────────────
	const dateLabel = $derived(
		new Date(data.date + 'T00:00:00').toLocaleDateString('default', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);

	// Back to month view for this date's month
	const [year, month] = data.date.split('-').map(Number);

	// ── Slot configuration ───────────────────────────────────────────────────
	const SLOT_OPTIONS = [15, 30, 60] as const;
	let slotMinutes = $state(60);

	const START_HOUR = 7;
	const END_HOUR = 22;

	const slots = $derived(
		Array.from({ length: ((END_HOUR - START_HOUR) * 60) / slotMinutes }, (_, i) => {
			const totalMins = START_HOUR * 60 + i * slotMinutes;
			const h = Math.floor(totalMins / 60);
			const m = totalMins % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		})
	);

	// Snap a booking time to its containing slot
	function toSlotKey(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const totalMins = h * 60 + (m ?? 0);
		const snapped = Math.floor(totalMins / slotMinutes) * slotMinutes;
		const sh = Math.floor(snapped / 60);
		const sm = snapped % 60;
		return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
	}

	// Group bookings by slot (only timed ones)
	const slottedBookings = $derived(() => {
		const map: Record<string, typeof data.bookings> = {};
		for (const b of data.bookings) {
			if (b.time) {
				const key = toSlotKey(b.time);
				(map[key] ??= []).push(b);
			}
		}
		return map;
	});

	const unscheduled = $derived(data.bookings.filter((b) => !b.time || b.isFlexible));

	// ── Color helpers ─────────────────────────────────────────────────────────
	function bookingBg(booking: (typeof data.bookings)[0]) {
		const c = getServiceColor(booking.serviceColor ?? '');
		if (booking.status === 'cancelled') return 'border-gray-300 bg-surface opacity-50 border-solid';
		const dashed = booking.isFlexible ? 'border-dashed' : 'border-solid';
		return `${c.border} ${c.bg} ${dashed}`;
	}

	function statusText(booking: (typeof data.bookings)[0]) {
		const c = getServiceColor(booking.serviceColor ?? '');
		if (booking.status === 'cancelled') return 'text-gray-400';
		return c.text;
	}

	// Show a label only at whole-hour marks even when slots < 60 min
	function showHourLabel(slot: string): boolean {
		return slot.endsWith(':00');
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- ── Header ── -->
	<div class="page-header">
		<div class="flex min-w-0 items-center gap-2">
			<a
				href="/calendar?view=month&year={year}&month={month}"
				class="btn-ghost btn-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0 text-base"
			>‹</a>
			<h1 class="page-title truncate">{dateLabel}</h1>
		</div>
		<div class="ml-3 flex shrink-0 items-center gap-2">
			<select
				bind:value={slotMinutes}
				class="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/20"
			>
				{#each SLOT_OPTIONS as opt}
					<option value={opt}>{opt} min</option>
				{/each}
			</select>
			<a href="/bookings/new?date={data.date}" class="btn-primary btn-sm">+ Booking</a>
		</div>
	</div>

	<!-- ── Scrollable body ── -->
	<div class="flex-1 overflow-y-auto">

		<!-- Events covering this day -->
		{#each data.events as event}
			<a
				href="/events/{event.id}"
				class="flex items-center gap-2 border-b border-confirmed/20 bg-confirmed/10 px-4 py-2.5"
			>
				<span>🏕️</span>
				<div>
					<p class="text-sm font-semibold text-gray-800">{event.title}</p>
					<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
				</div>
			</a>
		{/each}

		<!-- Unscheduled / flexible -->
		{#if unscheduled.length > 0}
			<div class="border-b border-border bg-pending/5 px-4 py-2">
				<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
					⚡ Unscheduled / flexible
				</p>
				<div class="space-y-1.5">
					{#each unscheduled as booking}
						<a
							href="/bookings/{booking.id}"
							class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {bookingBg(booking)}"
						>
							<div>
								<p class="text-sm font-medium text-gray-800">
									{booking.serviceName}
									{#if booking.firstClientName}
										<span class="font-normal text-muted"> · {booking.firstClientName}</span>
									{/if}
								</p>
								<p class="text-xs text-muted">{booking.instructorName ?? 'No instructor'}</p>
							</div>
							<span class="text-xs {statusText(booking)}">{booking.status}</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Time grid -->
		<div class="divide-y divide-border/50">
			{#each slots as slot}
				{@const bookingsHere = slottedBookings()[slot] ?? []}
				{@const isHour = showHourLabel(slot)}

				<div class="flex min-h-12 gap-0 {bookingsHere.length > 0 ? '' : 'hover:bg-sand/60'}">
					<!-- Time gutter -->
					<div class="w-14 shrink-0 border-r border-border/50 px-2 pt-1 text-right">
						{#if isHour}
							<span class="text-[11px] font-medium text-muted">{slot}</span>
						{:else}
							<span class="text-[9px] text-border">{slot}</span>
						{/if}
					</div>

					<!-- Slot content -->
					<div class="flex-1 px-2 py-1 {bookingsHere.length > 0 ? 'space-y-1' : ''}">
						{#each bookingsHere as booking}
							<a
								href="/bookings/{booking.id}"
								class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {bookingBg(booking)}"
							>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-gray-800">
										{booking.time ? booking.time.slice(0, 5) + ' ' : ''}{booking.serviceName}
										{#if booking.firstClientName}
											<span class="font-normal text-muted"> · {booking.firstClientName}{booking.clientCount > 1 ? ` +${booking.clientCount - 1}` : ''}</span>
										{/if}
									</p>
									<p class="text-xs text-muted">
										{booking.instructorName ?? 'No instructor'}
										{#if booking.isFlexible}<span class="text-flexible"> ⚡</span>{/if}
									</p>
								</div>
								<span class="ml-2 shrink-0 text-xs {statusText(booking)}">{booking.status}</span>
							</a>
						{/each}

						<!-- Empty slot: click to create a booking at that time -->
						{#if bookingsHere.length === 0 && isHour}
							<a
								href="/bookings/new?date={data.date}&time={slot}"
								class="block h-full w-full text-[10px] text-transparent hover:text-muted/60"
							>+ {slot}</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Bottom padding so last slot isn't under the FAB -->
		<div class="h-20"></div>
	</div>
</div>

<!-- FAB -->
<a
	href="/bookings/new?date={data.date}"
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-white shadow-lg shadow-ocean/30 transition-all hover:bg-blue-700 active:scale-95 md:bottom-6"
	aria-label="New booking"
>
	<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
</a>
