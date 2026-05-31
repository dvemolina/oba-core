<script lang="ts">
	import { groupBookingsByDate } from '$lib/features/calendar/utils';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';
	import type { BookingSummary } from '$lib/features/bookings/types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupBookingsByDate(data.bookings));
	const today = $derived(data.today);

	function agendaBookingsForDate(date: string): BookingSummary[] {
		return (grouped[date] ?? []).filter(
			b => b.status !== 'cancelled' && (!b.dateEnd || b.dateEnd === b.date || b.date === date)
		);
	}

	const cancelledBookings = $derived(() => {
		const seen = new Set<string>();
		const result: BookingSummary[] = [];
		for (const list of Object.values(grouped)) {
			for (const b of list) {
				if (b.status === 'cancelled' && !seen.has(b.id)) {
					seen.add(b.id);
					result.push(b);
				}
			}
		}
		return result.sort((a, b) => b.date.localeCompare(a.date));
	});

	const upcomingDates = $derived(
		Object.keys(grouped).filter(d => d >= today && agendaBookingsForDate(d).length > 0).sort()
	);
	const pastDates = $derived(
		Object.keys(grouped).filter(d => d < today && agendaBookingsForDate(d).length > 0).sort().reverse()
	);

	function cardClass(booking: BookingSummary): string {
		const c = getServiceColor(booking.serviceColor ?? '');
		if (booking.status === 'cancelled') return 'border-gray-300 bg-surface opacity-50 border-solid';
		return `${c.border} bg-surface ${booking.isFlexible ? 'border-dashed' : 'border-solid'}`;
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	<!-- Header -->
	<div class="page-header">
		<h1 class="page-title">Agenda</h1>
	</div>

	<div class="flex-1 overflow-y-auto">
		<div class="space-y-6 px-4 py-4">

			<!-- Active events (surf camps, multi-day) -->
			{#each data.events as event}
				<a href="/events/{event.id}" class="block rounded-(--radius-card) border border-confirmed/30 bg-confirmed/10 p-3">
					<div class="flex items-center gap-2">
						<div>
							<p class="text-sm font-semibold text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</div>
				</a>
			{/each}

			{#if upcomingDates.length === 0 && data.events.length === 0}
				<p class="py-16 text-center text-sm text-muted">No upcoming bookings.</p>
			{/if}

			<!-- Upcoming -->
			{#each upcomingDates as date}
				<div id={date}>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
						{date === today
							? 'Today'
							: new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
					</p>
					<div class="space-y-2">
						{#each agendaBookingsForDate(date) as booking}
							{@const isCamp = booking.serviceType === 'camp' && !!booking.dateEnd && booking.dateEnd !== booking.date}
							<a href="/bookings/{booking.id}"
								class="flex items-center justify-between rounded-(--radius-card) border-l-4 p-3 ring-1 ring-border {cardClass(booking)}">
								<div>
									<p class="text-sm font-medium text-gray-800">
										{#if isCamp}
											{booking.serviceName}
											<span class="ml-1 text-xs text-muted">{booking.date} → {booking.dateEnd}</span>
										{:else}
											{booking.time ? booking.time.slice(0, 5) : '—'}
											{#if booking.isFlexible}<span class="ml-1 text-flexible">⚡</span>{/if}
											· {booking.serviceName}
										{/if}
									</p>
									<p class="text-xs text-muted">
										{#if isCamp}
											{booking.clientCount}{booking.serviceMaxStudents != null ? ` / ${booking.serviceMaxStudents}` : ''} enrolled
										{:else}
											{booking.instructorName ?? 'No instructor'} · {booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}
										{/if}
									</p>
								</div>
								<span class="rounded-full px-2 py-0.5 text-xs {booking.status === 'confirmed' ? 'bg-confirmed/15 text-green-700' : 'bg-pending/30 text-amber-700'}">
									{booking.status}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Past bookings -->
			{#if pastDates.length > 0}
				<details class="mt-6">
					<summary class="cursor-pointer text-xs text-muted hover:text-gray-600">
						Past bookings ({pastDates.reduce((n, d) => n + agendaBookingsForDate(d).length, 0)})
					</summary>
					<div class="mt-3 space-y-4">
						{#each pastDates as date}
							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
									{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
								</p>
								<div class="space-y-2">
									{#each agendaBookingsForDate(date) as booking}
										{@const isCamp = booking.serviceType === 'camp' && !!booking.dateEnd && booking.dateEnd !== booking.date}
										<a href="/bookings/{booking.id}"
											class="flex items-center justify-between rounded-(--radius-card) border-l-4 p-3 opacity-70 ring-1 ring-border {cardClass(booking)}">
											<p class="text-sm text-gray-700">
												{isCamp ? '' : (booking.time?.slice(0, 5) ?? '—') + ' · '}{booking.serviceName}
											</p>
											<span class="text-xs text-muted">{booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}</span>
										</a>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/if}

			<!-- Cancelled -->
			{#if cancelledBookings().length > 0}
				<details class="mt-4">
					<summary class="cursor-pointer text-xs text-muted hover:text-gray-600">
						Cancelled ({cancelledBookings().length})
					</summary>
					<div class="mt-2 space-y-1">
						{#each cancelledBookings() as booking}
							<a href="/bookings/{booking.id}"
								class="flex items-center justify-between rounded-(--radius-card) border-l-4 border-solid border-gray-300 bg-surface p-3 opacity-50 ring-1 ring-border">
								<p class="text-sm text-gray-500 line-through">
									{booking.serviceName}
									<span class="ml-1 text-xs no-underline">{booking.date}</span>
								</p>
								<span class="text-xs text-muted">{booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}</span>
							</a>
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
