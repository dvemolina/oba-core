<script lang="ts">
	import type { PageData } from './$types';

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

	// ── Status helpers ────────────────────────────────────────────────────────
	function statusBg(status: string) {
		if (status === 'confirmed') return 'border-confirmed bg-confirmed/10';
		if (status === 'cancelled') return 'border-flexible bg-flexible/5 opacity-50';
		return 'border-pending bg-pending/10';
	}

	function paymentDot(booking: (typeof data.bookings)[0]) {
		// We don't have payment info in summary — just show status badge
		return booking.status === 'confirmed'
			? 'text-green-700'
			: booking.status === 'cancelled'
				? 'text-red-500'
				: 'text-amber-600';
	}

	// Show a label only at whole-hour marks even when slots < 60 min
	function showHourLabel(slot: string): boolean {
		return slot.endsWith(':00');
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- ── Header ── -->
	<div class="flex shrink-0 items-center justify-between border-b border-border bg-sand px-4 py-2.5">
		<div class="flex items-center gap-2 min-w-0">
			<a
				href="/calendar?view=month&year={year}&month={month}"
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg text-muted hover:bg-border hover:text-gray-700"
			>‹</a>
			<h1 class="truncate text-sm font-bold text-navy">{dateLabel}</h1>
		</div>
		<div class="flex shrink-0 items-center gap-2 ml-3">
			<!-- Slot-size selector -->
			<select
				bind:value={slotMinutes}
				class="rounded-md border border-border bg-white px-2 py-1 text-xs text-muted focus:border-ocean focus:outline-none"
			>
				{#each SLOT_OPTIONS as opt}
					<option value={opt}>{opt} min</option>
				{/each}
			</select>
			<a
				href="/bookings/new?date={data.date}"
				class="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-white hover:bg-ocean/90"
			>+ Booking</a>
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
							class="flex items-center justify-between rounded-lg border-l-4 border-dashed bg-surface px-3 py-2 ring-1 ring-border {statusBg(booking.status)}"
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
							<span class="text-xs {paymentDot(booking)}">{booking.status}</span>
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

				<div class="flex min-h-[3rem] gap-0 {bookingsHere.length > 0 ? '' : 'hover:bg-sand/60'}">
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
								class="flex items-center justify-between rounded-lg border-l-4 px-3 py-2 ring-1 ring-border {statusBg(booking.status)}"
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
								<span class="ml-2 shrink-0 text-xs {paymentDot(booking)}">{booking.status}</span>
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
	class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-2xl text-white shadow-lg transition-colors hover:bg-ocean/90 md:bottom-6"
	aria-label="New booking"
>+</a>
