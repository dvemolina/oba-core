# Dashboard — Today View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/agenda` page with a proper operator dashboard that answers "what do I need to deal with right now?" at a glance.

**Architecture:** Enhance the existing `/agenda` route (nav already links there as "Today"). The page shows: today's scheduled sessions with clients and instructors, a count of unscheduled upcoming sessions, active camps currently running, and outstanding payments. Existing `loadStats()` and `listSessionsForDateRange` are reused. Layout: summary stat cards at top, today's sessions timeline below, then upcoming unscheduled sessions, then active camps.

**Key data sources (all already exist):**
- `listSessionsForDate(today)` → today's sessions with instructors + participants
- `listSessionsForDateRange(today, future)` → for unscheduled count
- `listBookingsForDateRange(today, future)` → for active camps (filter `serviceHasRoster && dateEnd >= today`)
- `loadStats(today)` → pending revenue (already in agenda)
- `listEventsForDateRange(today, future)` → upcoming events

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind CSS v4, Paraglide (use `m.*` keys added in i18n plan)

---

## File Map

**Modify:**
- `src/routes/(app)/agenda/+page.server.ts` — enhance data loading (add today's sessions separately, unscheduled count, active camps)
- `src/routes/(app)/agenda/+page.svelte` — full redesign of the page layout

---

### Task 1: Enhance the agenda server

**Files:**
- Modify: `src/routes/(app)/agenda/+page.server.ts`

- [ ] **Step 1.1: Rewrite `src/routes/(app)/agenda/+page.server.ts`**

Read the current file. Replace the load function to provide richer data:

```typescript
import { eq, ne, sum, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingClients, bookings } from '$lib/server/db/schema';
import { isInstructorRole } from '$lib/server/permissions';
import { listSessionsForDate, listSessionsForDateRange } from '$lib/features/sessions/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { getTodayString, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

async function loadStats(today: string) {
	const [revenueRow] = await db
		.select({
			pendingRevenue: sum(
				sql`(${bookingClients.amountDue}::numeric - ${bookingClients.amountPaid}::numeric)`
			)
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			sql`${bookingClients.status} = 'enrolled'
			AND ${bookings.status} != 'cancelled'
			AND ${bookingClients.paymentStatus} != 'paid'`
		);
	return { pendingRevenue: parseFloat(revenueRow?.pendingRevenue ?? '0') || 0 };
}

export const load: PageServerLoad = async ({ locals }) => {
	const today = getTodayString();

	const future = new Date();
	future.setDate(future.getDate() + 60);
	const futureDateStr = formatDate(future);

	let instructorId: string | undefined;
	if (isInstructorRole(locals)) {
		instructorId = locals.user!.id;
	}

	const [
		todaySessions,
		upcomingSessions,
		upcomingBookings,
		upcomingEvents,
		stats
	] = await Promise.all([
		listSessionsForDate(today, instructorId),
		listSessionsForDateRange(today, futureDateStr, instructorId),
		listBookingsForDateRange(today, futureDateStr),
		listEventsForDateRange(today, futureDateStr),
		loadStats(today)
	]);

	// Active camps: roster bookings currently running or starting today
	const activeCamps = upcomingBookings.filter(
		b => b.serviceHasRoster && b.dateEnd && b.status !== 'cancelled' && b.dateEnd >= today
	);

	// Unscheduled upcoming sessions (not today — today's are shown separately)
	const unscheduledUpcoming = upcomingSessions.filter(
		s => s.status === 'unscheduled' && s.date > today
	);

	// Today scheduled count
	const scheduledToday = todaySessions.filter(s => s.status === 'scheduled').length;
	const unscheduledToday = todaySessions.filter(s => s.status === 'unscheduled').length;

	// Upcoming events (next 60 days)
	const nextEvents = upcomingEvents.filter(e => e.startDate >= today).slice(0, 3);

	return {
		today,
		todaySessions,
		scheduledToday,
		unscheduledToday,
		unscheduledUpcoming,
		activeCamps,
		nextEvents,
		stats: {
			pendingRevenue: stats.pendingRevenue,
			unscheduledCount: unscheduledUpcoming.length,
			activeCampCount: activeCamps.length
		}
	};
};
```

- [ ] **Step 1.2: Commit**

```bash
git add "src/routes/(app)/agenda/+page.server.ts"
git commit -m "feat: dashboard — enhanced data loading (today sessions, stats, active camps)"
```

---

### Task 2: Dashboard UI

**Files:**
- Modify: `src/routes/(app)/agenda/+page.svelte`

- [ ] **Step 2.1: Rewrite `src/routes/(app)/agenda/+page.svelte`**

Full replacement. The dashboard has four sections:

1. **Header** — "Hoy, [date]" + quick action "+ Nueva reserva"
2. **Stats row** — 3-4 stat cards: today's sessions, unscheduled, pending revenue, active camps
3. **Today's sessions** — timeline list with time, service, instructor, client names, status badge
4. **Needs attention** — unscheduled upcoming sessions (count + link to calendar), active camps

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();

	const today = new Date(data.today + 'T00:00:00');
	const dayLabel = today.toLocaleDateString('default', {
		weekday: 'long', day: 'numeric', month: 'long'
	});

	function formatTime(t: string | null) {
		if (!t) return null;
		return t.slice(0, 5);
	}
</script>

<div class="p-4 md:p-6">

	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold capitalize text-navy">{dayLabel}</h1>
			<p class="text-sm text-muted">{m.agenda_title()}</p>
		</div>
		<a href="/bookings/new" class="btn-primary btn-sm">{m.agenda_new_booking()}</a>
	</div>

	<!-- Stats row -->
	<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<p class="text-2xl font-bold text-navy">{data.scheduledToday}</p>
			<p class="text-xs text-muted">Sesiones hoy</p>
		</div>
		{#if data.unscheduledToday > 0}
			<a href="/calendar?view=day&date={data.today}" class="rounded-(--radius-card) bg-amber-50 p-4 ring-1 ring-amber-200 hover:ring-amber-400">
				<p class="text-2xl font-bold text-amber-700">{data.unscheduledToday}</p>
				<p class="text-xs text-amber-600">Sin hora hoy</p>
			</a>
		{:else}
			<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<p class="text-2xl font-bold text-navy">{data.unscheduledToday}</p>
				<p class="text-xs text-muted">Sin hora hoy</p>
			</div>
		{/if}
		{#if data.stats.unscheduledCount > 0}
			<a href="/calendar" class="rounded-(--radius-card) bg-amber-50 p-4 ring-1 ring-amber-200 hover:ring-amber-400">
				<p class="text-2xl font-bold text-amber-700">{data.stats.unscheduledCount}</p>
				<p class="text-xs text-amber-600">Por programar</p>
			</a>
		{:else}
			<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<p class="text-2xl font-bold text-green-600">✓</p>
				<p class="text-xs text-muted">Al día</p>
			</div>
		{/if}
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<p class="text-2xl font-bold text-navy">€{data.stats.pendingRevenue.toFixed(0)}</p>
			<p class="text-xs text-muted">Pendiente cobro</p>
		</div>
	</div>

	<!-- Today's sessions -->
	<section class="mb-6">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Sesiones de hoy</h2>
		{#if data.todaySessions.length === 0}
			<p class="rounded-(--radius-card) bg-surface p-6 text-center text-sm text-muted ring-1 ring-border">
				No hay sesiones para hoy.
			</p>
		{:else}
			<div class="space-y-2">
				{#each data.todaySessions as session}
					<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border {session.status === 'cancelled' ? 'opacity-50' : ''}">
						<div class="flex items-start gap-3">
							<!-- Time -->
							<div class="w-14 shrink-0 text-center">
								{#if session.time}
									<p class="text-sm font-bold text-navy">{formatTime(session.time)}</p>
								{:else}
									<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Sin hora</span>
								{/if}
								{#if session.durationMinutes}
									<p class="text-xs text-muted">{session.durationMinutes}m</p>
								{/if}
							</div>

							<!-- Content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium text-gray-800">
										{#if session.bookings?.[0]?.serviceName}
											{session.bookings[0].serviceName}
										{:else}
											Sesión
										{/if}
									</p>
									<span class="rounded-full px-2 py-0.5 text-xs font-medium
										{session.status === 'scheduled' ? 'bg-green-100 text-green-700' :
										 session.status === 'completed' ? 'bg-gray-100 text-gray-600' :
										 session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
										 'bg-amber-100 text-amber-700'}">
										{session.status === 'scheduled' ? 'Programada' :
										 session.status === 'completed' ? 'Completada' :
										 session.status === 'cancelled' ? 'Cancelada' : 'Sin hora'}
									</span>
								</div>

								<!-- Instructors -->
								{#if session.instructors?.length}
									<p class="text-xs text-muted">
										🌊 {session.instructors.map(i => i.instructorName).join(', ')}
									</p>
								{/if}

								<!-- Clients from bookings -->
								{#if session.bookings?.length}
									<p class="text-xs text-muted">
										👤 {session.bookings.flatMap(b => b.clientNames ?? []).filter(Boolean).join(', ') || 'Sin clientes asignados'}
									</p>
								{/if}

								<!-- Participants -->
								{#if session.participants?.length}
									<p class="text-xs text-muted">
										🏄 {session.participants.map(p => p.name).join(', ')}
									</p>
								{/if}

								{#if session.notes}
									<p class="mt-1 text-xs text-muted italic">{session.notes}</p>
								{/if}
							</div>

							<!-- Action -->
							<a href="/calendar?view=day&date={data.today}" class="shrink-0 text-xs text-ocean hover:underline">
								Ver →
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Active camps -->
	{#if data.activeCamps.length > 0}
		<section class="mb-6">
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Camps activos</h2>
			<div class="space-y-2">
				{#each data.activeCamps as camp}
					<a
						href="/bookings/{camp.id}"
						class="flex items-center justify-between rounded-(--radius-card) bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
					>
						<div>
							<p class="font-medium text-gray-800">{camp.serviceName ?? 'Camp'}</p>
							<p class="text-xs text-muted">{camp.date} → {camp.dateEnd}</p>
							{#if camp.serviceRunStartDate}
								<p class="text-xs text-muted">Edición: {camp.serviceRunStartDate} → {camp.serviceRunEndDate}</p>
							{/if}
						</div>
						<div class="text-right">
							{#if camp.serviceMaxCapacity}
								<p class="text-sm font-semibold text-navy">{camp.clientCount}/{camp.serviceMaxCapacity}</p>
								<p class="text-xs text-muted">inscritos</p>
							{:else}
								<p class="text-sm font-semibold text-navy">{camp.clientCount}</p>
								<p class="text-xs text-muted">inscritos</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Upcoming events -->
	{#if data.nextEvents.length > 0}
		<section class="mb-6">
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Próximos eventos</h2>
			<div class="space-y-2">
				{#each data.nextEvents as event}
					<a
						href="/events/{event.id}"
						class="flex items-center justify-between rounded-(--radius-card) bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
					>
						<div>
							<p class="font-medium text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Needs scheduling -->
	{#if data.unscheduledUpcoming.length > 0}
		<section>
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-xs font-semibold uppercase tracking-wider text-muted">Por programar</h2>
				<a href="/calendar" class="text-xs text-ocean hover:underline">{m.agenda_view_all()}</a>
			</div>
			<a
				href="/calendar"
				class="flex items-center gap-3 rounded-(--radius-card) bg-amber-50 p-4 ring-1 ring-amber-200 hover:ring-amber-400"
			>
				<span class="text-2xl font-bold text-amber-700">{data.unscheduledUpcoming.length}</span>
				<div>
					<p class="text-sm font-medium text-amber-800">
						{data.unscheduledUpcoming.length === 1 ? 'sesión pendiente de programar' : 'sesiones pendientes de programar'}
					</p>
					<p class="text-xs text-amber-600">Ir al calendario para asignar hora →</p>
				</div>
			</a>
		</section>
	{/if}

</div>
```

**Note on `session.bookings`:** The `SessionForDay` type may not include booking/client data. Check `src/lib/features/sessions/types.ts` and the `listSessionsForDate` return type. If `bookings` or client names aren't included, adjust the template to omit that section or use `session.participants` only. The instructors array IS included based on the existing `attachInstructors` helper.

- [ ] **Step 2.2: Run type check**

```bash
pnpm check 2>&1 | grep "Error" | grep -v WARNING | head -20
```

Fix any type errors — `session.bookings` may not exist on the type. Remove that block if needed and just show instructor + participant names.

- [ ] **Step 2.3: Commit**

```bash
git add "src/routes/(app)/agenda/+page.svelte"
git commit -m "feat: dashboard — today view with sessions, stats, camps, events"
```

---
