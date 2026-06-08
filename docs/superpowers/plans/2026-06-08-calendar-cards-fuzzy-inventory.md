# Calendar Rich Cards + Fuzzy Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace calendar session dots/links with rich interactive cards, and surface fuzzy inventory allocation (reserve type without specifying variant) across booking detail, inventory detail, and calendar day view.

**Architecture:** Three independent features. Features 1 (button fix) and 2 (calendar cards) touch only UI/Svelte files. Feature 3 (fuzzy inventory) adds a new `availability.ts` utility and enhances existing booking/inventory/calendar views — no DB migration needed (`itemId IS NULL` already encodes "fuzzy" in the existing schema).

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Tailwind CSS v4, Drizzle ORM, Paraglide i18n

---

## File Map

**New files:**
- `src/lib/components/ui/Popover.svelte` — generic portal popover, reusable app-wide
- `src/lib/components/calendar/SessionCardInfo.svelte` — shared session info sub-component
- `src/lib/components/calendar/SessionCard.svelte` — compact + medium variants for month/week
- `src/lib/components/inventory/AllocationBadge.svelte` — pending/confirmed allocation chip
- `src/lib/features/inventory/availability.ts` — breakdown + timeline + shortage queries

**Modified files:**
- `messages/es.json` — update `booking_new_accommodation`, add `calendar_view_day`
- `messages/en.json` — same
- `src/routes/(app)/bookings/new/+page.svelte` — simplify submit button
- `src/routes/(app)/calendar/+page.svelte` — replace month dots + week links
- `src/routes/(app)/bookings/[id]/+page.svelte` — enhance allocation list UI
- `src/routes/(app)/bookings/[id]/+page.server.ts` — load shortage data
- `src/routes/(app)/inventory/[id]/+page.svelte` — add availability timeline
- `src/routes/(app)/inventory/[id]/+page.server.ts` — load timeline data
- `src/routes/(app)/calendar/+page.server.ts` — load shortage flag for day view

---

## Feature 1 — Button Label Fix

### Task 1: Update i18n keys and simplify button logic

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`
- Modify: `src/routes/(app)/bookings/new/+page.svelte:266-269`

- [ ] **Step 1: Update Spanish message**

In `messages/es.json`, change line 101:
```json
"booking_new_accommodation": "Crear reserva",
```
Also add after line 101 (or anywhere in the booking section):
```json
"calendar_view_day": "Ver día",
```

- [ ] **Step 2: Update English message**

In `messages/en.json`, change line 102:
```json
"booking_new_accommodation": "Create Booking",
```
Also add:
```json
"calendar_view_day": "View Day",
```

- [ ] **Step 3: Simplify button text in new booking form**

In `src/routes/(app)/bookings/new/+page.svelte`, find line ~268 and replace:
```svelte
{loading ? m.booking_new_saving() : (isAccommodation ? m.booking_new_accommodation() : m.booking_new_submit())}
```
With:
```svelte
{loading ? m.booking_new_saving() : m.booking_new_accommodation()}
```
(Both keys now say "Crear reserva" / "Create Booking" — accommodation key wins since it was the outlier being fixed. The submit key `booking_new_submit` = "Guardar reserva" is kept for possible future use.)

- [ ] **Step 4: Verify in browser**

Run `pnpm dev`, open `/bookings/new`, confirm button shows "Crear reserva" for all service types.

- [ ] **Step 5: Commit**

```bash
git add messages/es.json messages/en.json src/routes/\(app\)/bookings/new/+page.svelte
git commit -m "fix(bookings): unify submit button label to 'Crear reserva'"
```

---

## Feature 2 — Calendar Rich Session Cards

### Task 2: Popover.svelte — generic reusable popover

**Files:**
- Create: `src/lib/components/ui/Popover.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/ui/Popover.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		open,
		triggerRect,
		onclose,
		children
	}: {
		open: boolean;
		triggerRect: DOMRect | null;
		onclose: () => void;
		children?: Snippet;
	} = $props();

	let popoverEl = $state<HTMLDivElement | null>(null);
	let top = $state(0);
	let left = $state(0);

	$effect(() => {
		if (open && triggerRect) {
			tick().then(() => {
				if (!popoverEl) return;
				const pw = popoverEl.offsetWidth;
				const ph = popoverEl.offsetHeight;
				let t = triggerRect.bottom + 6;
				let l = triggerRect.left;
				if (l + pw > window.innerWidth - 8) l = Math.max(8, window.innerWidth - pw - 8);
				if (t + ph > window.innerHeight - 8) t = triggerRect.top - ph - 6;
				top = Math.max(8, t);
				left = Math.max(8, l);
			});
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleMousedown(e: MouseEvent) {
		if (popoverEl && !popoverEl.contains(e.target as Node)) onclose();
	}
</script>

<svelte:document onkeydown={handleKeydown} onmousedown={handleMousedown} />

{#if open}
	<div
		bind:this={popoverEl}
		style="position:fixed;top:{top}px;left:{left}px"
		class="z-50 min-w-52 rounded-xl border border-border bg-white p-3 shadow-lg"
		role="tooltip"
	>
		{@render children?.()}
	</div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ui/Popover.svelte
git commit -m "feat(ui): add generic Popover component"
```

---

### Task 3: SessionCardInfo.svelte — shared session info sub-component

**Files:**
- Create: `src/lib/components/calendar/SessionCardInfo.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/calendar/SessionCardInfo.svelte -->
<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';

	let {
		serviceName,
		serviceColor,
		time,
		participantNames,
		bookingStatus,
		date
	}: {
		serviceName: string | null;
		serviceColor: string | null;
		time: string | null;
		participantNames: string[];
		bookingStatus: string;
		date: string;
	} = $props();

	const color = $derived(getServiceColor(serviceColor ?? ''));

	const statusClass = $derived(
		bookingStatus === 'confirmed'
			? 'bg-emerald-50 text-emerald-700'
			: bookingStatus === 'cancelled'
				? 'bg-gray-100 text-gray-400'
				: 'bg-amber-50 text-amber-700'
	);
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center gap-2">
		<span class="h-2.5 w-2.5 shrink-0 rounded-full {color.bg} ring-1 {color.border}"></span>
		<span class="text-sm font-semibold text-gray-900">{serviceName ?? '—'}</span>
	</div>
	<p class="text-xs text-muted">
		{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
		{#if time} · {time.slice(0, 5)}{/if}
	</p>
	{#if participantNames.length > 0}
		<p class="text-xs text-gray-700">
			{participantNames[0]}
			{#if participantNames.length > 1}
				<span class="text-muted"> +{participantNames.length - 1}</span>
			{/if}
		</p>
	{/if}
	<span class="inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium {statusClass}">
		{bookingStatus}
	</span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/calendar/SessionCardInfo.svelte
git commit -m "feat(calendar): add SessionCardInfo shared sub-component"
```

---

### Task 4: SessionCard.svelte — compact + medium card with popover

**Files:**
- Create: `src/lib/components/calendar/SessionCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/calendar/SessionCard.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getServiceColor } from '$lib/features/services/colors';
	import Popover from '$lib/components/ui/Popover.svelte';
	import SessionCardInfo from './SessionCardInfo.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { AgendaSession } from '$lib/features/sessions/types';

	let {
		session,
		size
	}: {
		session: AgendaSession;
		size: 'compact' | 'medium';
	} = $props();

	const color = $derived(getServiceColor(session.serviceColor ?? ''));

	let cardEl = $state<HTMLElement | null>(null);
	let popoverOpen = $state(false);
	let triggerRect = $state<DOMRect | null>(null);
	let isTouch = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		isTouch = !window.matchMedia('(hover: hover)').matches;
	});

	function showPopover() {
		if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
		triggerRect = cardEl?.getBoundingClientRect() ?? null;
		popoverOpen = true;
	}

	function scheduleHide() {
		hideTimeout = setTimeout(() => { popoverOpen = false; }, 150);
	}

	function handleClick(e: MouseEvent) {
		if (isTouch) {
			e.preventDefault();
			if (popoverOpen) popoverOpen = false;
			else showPopover();
		} else {
			goto(`/bookings/${session.bookingId}`);
		}
	}
</script>

{#if size === 'compact'}
	<button
		bind:this={cardEl}
		type="button"
		class="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight {color.bg} {color.text} hover:brightness-95"
		onmouseenter={showPopover}
		onmouseleave={scheduleHide}
		onclick={handleClick}
	>
		{session.time ? session.time.slice(0, 5) + ' ' : ''}{session.serviceName ?? 'Session'}
	</button>
{:else}
	<button
		bind:this={cardEl}
		type="button"
		class="mb-0.5 block w-full rounded-lg px-2 py-1.5 text-left ring-1 {color.bg} {color.border} hover:brightness-95"
		onmouseenter={showPopover}
		onmouseleave={scheduleHide}
		onclick={handleClick}
	>
		{#if session.time}
			<p class="text-[10px] font-semibold {color.text}">{session.time.slice(0, 5)}</p>
		{/if}
		<p class="truncate text-[11px] font-medium text-gray-800">{session.serviceName ?? 'Session'}</p>
		{#if session.participantNames.length > 0}
			<p class="truncate text-[10px] text-muted">
				{session.participantNames[0]}{session.participantNames.length > 1 ? ` +${session.participantNames.length - 1}` : ''}
			</p>
		{/if}
	</button>
{/if}

<Popover open={popoverOpen} {triggerRect} onclose={() => { popoverOpen = false; }}>
	<div onmouseenter={showPopover} onmouseleave={scheduleHide} role="presentation">
		<SessionCardInfo
			serviceName={session.serviceName}
			serviceColor={session.serviceColor}
			time={session.time}
			participantNames={session.participantNames}
			bookingStatus={session.bookingStatus}
			date={session.date}
		/>
		<div class="mt-3 flex gap-2">
			<a
				href="/bookings/{session.bookingId}"
				class="flex-1 rounded-lg bg-ocean py-1.5 text-center text-xs font-semibold text-white hover:bg-ocean/90"
			>
				{m.calendar_view_booking()}
			</a>
			<a
				href="/calendar?view=day&date={session.date}"
				class="flex-1 rounded-lg border border-border py-1.5 text-center text-xs text-muted hover:bg-sand"
			>
				{m.calendar_view_day()}
			</a>
		</div>
	</div>
</Popover>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/calendar/SessionCard.svelte
git commit -m "feat(calendar): add SessionCard component (compact + medium + popover)"
```

---

### Task 5: Replace month view session dots with compact SessionCards

**Files:**
- Modify: `src/routes/(app)/calendar/+page.svelte`

- [ ] **Step 1: Add import at top of script block**

In `src/routes/(app)/calendar/+page.svelte`, add to the imports section (after existing imports, around line 10):
```svelte
import SessionCard from '$lib/components/calendar/SessionCard.svelte';
```

- [ ] **Step 2: Replace dot indicator with SessionCard chips**

Find this block (around lines 451-460 in month view):
```svelte
<!-- session count dot -->
{#if daySessionCount > 0}
	<span class="mt-0.5 flex items-center justify-center gap-0.5">
		<span class="inline-block h-1.5 w-1.5 rounded-full bg-ocean/70"></span>
		{#if daySessionCount > 1}
			<span class="text-[9px] text-muted leading-none">{daySessionCount}</span>
		{/if}
	</span>
{/if}
```

Replace with:
```svelte
<!-- session compact cards -->
{#each data.rangedSessions.filter(s => s.date === dateStr).slice(0, 3) as session}
	<SessionCard {session} size="compact" />
{/each}
{#if data.rangedSessions.filter(s => s.date === dateStr).length > 3}
	<span class="text-[9px] text-muted leading-none px-1">
		+{data.rangedSessions.filter(s => s.date === dateStr).length - 3}
	</span>
{/if}
```

Note: `.slice(0, 3)` prevents overflow in tight month cells. A "+N more" label shows if sessions exceed 3.

- [ ] **Step 3: Verify — open calendar month view**

Run `pnpm dev`, navigate to calendar month view. Sessions that previously showed as dots should now show as colored pill chips with truncated text.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/calendar/+page.svelte
git commit -m "feat(calendar): replace month view session dots with compact SessionCards"
```

---

### Task 6: Replace week view session links with medium SessionCards

**Files:**
- Modify: `src/routes/(app)/calendar/+page.svelte`

- [ ] **Step 1: Find and replace week view session rendering**

In `src/routes/(app)/calendar/+page.svelte`, inside the week view column loop (around lines 518-525), find:
```svelte
{#each daySessions as s}
	{@const c = getServiceColor(s.serviceColor ?? '')}
	<a href="/bookings/{s.bookingId}"
		class="block truncate rounded px-1.5 py-0.5 text-[10px] leading-tight {c.bg} {c.text} ring-1 {c.border} mb-0.5">
		{s.time ? s.time.slice(0, 5) + ' ' : ''}{s.serviceName ?? 'Session'}
	</a>
{/each}
```

Replace with:
```svelte
{#each daySessions as s}
	<SessionCard session={s} size="medium" />
{/each}
```

- [ ] **Step 2: Remove now-unused getServiceColor import from week column section**

Check if `getServiceColor` is still used elsewhere in the file. If the week view was the only usage for session links, remove the `getServiceColor` import only if it has zero remaining usages. (It is still used in other places — `chipClasses`, `dayBookingBg` — so leave the import.)

- [ ] **Step 3: Verify — open calendar week view**

Navigate to week view. Session links should now be medium cards with service color, time, participant name.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/calendar/+page.svelte
git commit -m "feat(calendar): replace week view session links with medium SessionCards"
```

---

## Feature 3 — Fuzzy Inventory

> **Scope note:** Fuzzy allocation creation in `/bookings/new` is deferred to the architecture session (it requires redesigning the booking create form modules). This feature covers: availability utility, enhanced booking detail UI, inventory detail timeline, and calendar day shortage badge.

### Task 7: availability.ts — breakdown, timeline, and shortage queries

**Files:**
- Create: `src/lib/features/inventory/availability.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/features/inventory/availability.ts
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { inventoryAllocations, inventoryItemTypes } from '$lib/server/db/schema';

export interface AvailabilityBreakdown {
	total: number;
	confirmed: number;
	pending: number;
	available: number;
}

/** Confirmed = itemId IS NOT NULL. Pending/fuzzy = itemId IS NULL. */
export async function getAvailabilityBreakdown(
	itemTypeId: string,
	date: string
): Promise<AvailabilityBreakdown> {
	const [type] = await db
		.select({ totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.id, itemTypeId));

	if (!type) return { total: 0, confirmed: 0, pending: 0, available: 0 };

	const rows = await db
		.select({
			itemId: inventoryAllocations.itemId,
			quantity: inventoryAllocations.quantity
		})
		.from(inventoryAllocations)
		.where(
			and(
				eq(inventoryAllocations.itemTypeId, itemTypeId),
				ne(inventoryAllocations.status, 'returned'),
				ne(inventoryAllocations.status, 'lost'),
				lte(inventoryAllocations.startDate, date),
				gte(
					sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
					date
				)
			)
		);

	let confirmed = 0;
	let pending = 0;
	for (const r of rows) {
		if (r.itemId) confirmed += r.quantity;
		else pending += r.quantity;
	}

	const total = type.totalPoolSize ?? 0;
	return { total, confirmed, pending, available: total - confirmed - pending };
}

/** Returns per-day breakdown for a date range (inclusive). */
export async function getAvailabilityTimeline(
	itemTypeId: string,
	fromDate: string,
	toDate: string
): Promise<Array<{ date: string } & AvailabilityBreakdown>> {
	const [type] = await db
		.select({ totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.id, itemTypeId));

	const total = type?.totalPoolSize ?? 0;

	const rows = await db
		.select({
			itemId: inventoryAllocations.itemId,
			quantity: inventoryAllocations.quantity,
			startDate: inventoryAllocations.startDate,
			endDate: inventoryAllocations.endDate
		})
		.from(inventoryAllocations)
		.where(
			and(
				eq(inventoryAllocations.itemTypeId, itemTypeId),
				ne(inventoryAllocations.status, 'returned'),
				ne(inventoryAllocations.status, 'lost'),
				lte(inventoryAllocations.startDate, toDate),
				gte(
					sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
					fromDate
				)
			)
		);

	const dates: string[] = [];
	const cur = new Date(fromDate + 'T00:00:00');
	const end = new Date(toDate + 'T00:00:00');
	while (cur <= end) {
		dates.push(cur.toISOString().slice(0, 10));
		cur.setDate(cur.getDate() + 1);
	}

	return dates.map((date) => {
		let confirmed = 0;
		let pending = 0;
		for (const r of rows) {
			const endD = r.endDate ?? r.startDate;
			if (r.startDate <= date && endD >= date) {
				if (r.itemId) confirmed += r.quantity;
				else pending += r.quantity;
			}
		}
		return { date, total, confirmed, pending, available: total - confirmed - pending };
	});
}

/** Returns item type IDs where available < 0 on the given date. */
export async function getInventoryShortagesForDate(date: string): Promise<string[]> {
	const types = await db
		.select({ id: inventoryItemTypes.id, totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.active, true));

	const poolTypes = types.filter((t) => t.totalPoolSize != null && t.totalPoolSize > 0);
	const shortages: string[] = [];

	for (const type of poolTypes) {
		const breakdown = await getAvailabilityBreakdown(type.id, date);
		if (breakdown.available < 0) shortages.push(type.id);
	}

	return shortages;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/inventory/availability.ts
git commit -m "feat(inventory): add availability breakdown, timeline, and shortage queries"
```

---

### Task 8: AllocationBadge.svelte — pending/confirmed allocation chip

**Files:**
- Create: `src/lib/components/inventory/AllocationBadge.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/inventory/AllocationBadge.svelte -->
<script lang="ts">
	import type { InventoryAllocationWithDetails } from '$lib/features/inventory/types';

	let {
		allocation,
		onAssign
	}: {
		allocation: InventoryAllocationWithDetails;
		onAssign?: (allocId: string) => void;
	} = $props();

	const isFuzzy = $derived(allocation.itemId === null);
</script>

<div
	class="flex items-center gap-2 rounded-lg border px-3 py-2.5
	{isFuzzy ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100 bg-white'}"
>
	<div class="min-w-0 flex-1">
		<p class="text-sm font-medium text-gray-900">
			{allocation.quantity}× {allocation.itemTypeName}
		</p>
		{#if isFuzzy}
			<p class="text-xs text-amber-600">⚠ Pendiente de asignar</p>
		{:else if allocation.itemName}
			<p class="text-xs text-gray-500">{allocation.itemName}</p>
		{:else if allocation.attributeFilter && Object.keys(allocation.attributeFilter).length > 0}
			<div class="mt-0.5 flex flex-wrap gap-1">
				{#each Object.values(allocation.attributeFilter) as v}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{v}</span>
				{/each}
			</div>
		{/if}
	</div>
	{#if isFuzzy && onAssign}
		<button
			type="button"
			onclick={() => onAssign(allocation.id)}
			class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-200"
		>
			Asignar
		</button>
	{/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/inventory/AllocationBadge.svelte
git commit -m "feat(inventory): add AllocationBadge component for pending/confirmed allocations"
```

---

### Task 9: Booking detail — use AllocationBadge, highlight fuzzy allocations

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 1: Add import**

In `src/routes/(app)/bookings/[id]/+page.svelte`, add to the imports section:
```svelte
import AllocationBadge from '$lib/components/inventory/AllocationBadge.svelte';
```

- [ ] **Step 2: Replace the existing allocation list `<ul>` with AllocationBadge**

Find the existing allocation list (around line 471):
```svelte
{#if data.booking.allocations.length > 0}
<ul class="divide-y divide-gray-100">
	{#each data.booking.allocations as alloc}
	<li class="flex items-center justify-between gap-3 px-4 py-3">
		<div class="min-w-0">
			<p class="text-sm font-medium text-gray-900">
				{alloc.quantity}× {alloc.itemTypeName}
			</p>
			...
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<form method="POST" action="?/updateAllocStatus" ...>...</form>
			<form method="POST" action="?/removeAlloc" ...>...</form>
		</div>
	</li>
	{/each}
</ul>
```

Replace with:
```svelte
{#if data.booking.allocations.length > 0}
<div class="flex flex-col gap-2 px-4 py-3">
	{#each data.booking.allocations as alloc}
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<AllocationBadge
					allocation={alloc}
					onAssign={(id) => { reassigningAllocId = reassigningAllocId === id ? null : id; }}
				/>
				{#if reassigningAllocId === alloc.id}
					<form method="POST" action="?/reassignAllocItem" use:enhance={withToast()}
						class="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-2"
						onsubmit={() => { reassigningAllocId = null; }}>
						<input type="hidden" name="allocId" value={alloc.id} />
						<select name="itemId" class="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm">
							<option value="">— sin asignar —</option>
							{#each (data.availableItemsByType[alloc.itemTypeId] ?? []) as item}
								<option value={item.id} selected={alloc.itemId === item.id}>{item.name}</option>
							{/each}
						</select>
						<button type="submit"
							class="shrink-0 rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-white hover:bg-ocean/90">
							Guardar
						</button>
					</form>
				{/if}
			</div>
			<form method="POST" action="?/removeAlloc" use:enhance={withToast()}>
				<input type="hidden" name="allocId" value={alloc.id} />
				<button type="submit"
					onclick={(e) => { if (!confirm('Remove this allocation?')) e.preventDefault(); }}
					class="mt-2.5 shrink-0 rounded p-1 text-gray-400 hover:text-red-500">✕</button>
			</form>
		</div>
	{/each}
</div>
```

- [ ] **Step 3: Verify server provides `availableItemsByType`**

Open `src/routes/(app)/bookings/[id]/+page.server.ts` and check that `availableItemsByType` is already loaded (it should be — the existing code loads items for reassignment). Look for the variable around lines 60-80. If it exists with a different name, update the template above to match the actual variable name.

- [ ] **Step 4: Verify in browser**

Navigate to a booking that has inventory allocations. Allocations with `itemId = null` (fuzzy) should show amber badge "⚠ Pendiente de asignar" with an "Asignar" button. Allocations with `itemId` set should show the item name normally.

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/bookings/\[id\]/+page.svelte
git commit -m "feat(bookings): use AllocationBadge, highlight fuzzy inventory allocations"
```

---

### Task 10: Inventory detail — add 14-day availability timeline

**Files:**
- Modify: `src/routes/(app)/inventory/[id]/+page.server.ts`
- Modify: `src/routes/(app)/inventory/[id]/+page.svelte`

- [ ] **Step 1: Load timeline in server**

In `src/routes/(app)/inventory/[id]/+page.server.ts`, add import:
```typescript
import { getAvailabilityTimeline } from '$lib/features/inventory/availability';
```

In the `load` function, add after existing data loads:
```typescript
const today = new Date().toISOString().slice(0, 10);
const twoWeeksLater = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
const timeline = itemType.trackingMode === 'pool' && (itemType.totalPoolSize ?? 0) > 0
	? await getAvailabilityTimeline(params.id, today, twoWeeksLater)
	: [];

return { ...(existing return), timeline };
```

- [ ] **Step 2: Render timeline in page**

In `src/routes/(app)/inventory/[id]/+page.svelte`, add a new section after the items list (before the closing `</div>` of the main content). Add this section only when `data.timeline.length > 0`:

```svelte
{#if data.timeline.length > 0}
<section class="mt-6 rounded-xl border border-border bg-surface p-4">
	<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
		Disponibilidad — próximos 14 días
	</h2>
	<div class="overflow-x-auto">
		<table class="w-full text-xs">
			<thead>
				<tr class="border-b border-border text-left text-muted">
					<th class="pb-1.5 font-medium">Fecha</th>
					<th class="pb-1.5 font-medium text-right">Confirmado</th>
					<th class="pb-1.5 font-medium text-right">Pendiente</th>
					<th class="pb-1.5 font-medium text-right">Disponible</th>
				</tr>
			</thead>
			<tbody>
				{#each data.timeline as row}
					{@const isShortage = row.available < 0}
					{@const hasPending = row.pending > 0}
					<tr class="border-b border-border/40 last:border-b-0 {isShortage ? 'bg-red-50' : hasPending ? 'bg-amber-50/40' : ''}">
						<td class="py-1.5 font-medium text-gray-700">
							{new Date(row.date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
						</td>
						<td class="py-1.5 text-right text-gray-600">{row.confirmed}</td>
						<td class="py-1.5 text-right {hasPending ? 'font-semibold text-amber-600' : 'text-gray-600'}">{row.pending}</td>
						<td class="py-1.5 text-right font-semibold {isShortage ? 'text-red-600' : row.available === 0 ? 'text-amber-600' : 'text-emerald-600'}">
							{row.available}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-2 text-[10px] text-muted">
		Confirmado = item específico asignado · Pendiente = reservado sin variante · Verde = disponible · Rojo = déficit
	</p>
</section>
{/if}
```

- [ ] **Step 3: Verify in browser**

Navigate to an inventory item type detail page (pool mode with `totalPoolSize > 0`). Should show the 14-day table at the bottom. Days with pending fuzzy allocations appear amber. Days with deficit appear red.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/inventory/\[id\]/+page.server.ts src/routes/\(app\)/inventory/\[id\]/+page.svelte
git commit -m "feat(inventory): add 14-day availability timeline to item type detail"
```

---

### Task 11: Calendar day view — inventory shortage badge

**Files:**
- Modify: `src/routes/(app)/calendar/+page.server.ts`
- Modify: `src/routes/(app)/calendar/+page.svelte`

- [ ] **Step 1: Load shortage data in server**

In `src/routes/(app)/calendar/+page.server.ts`, add import:
```typescript
import { getInventoryShortagesForDate } from '$lib/features/inventory/availability';
```

In the `load` function, add to the `Promise.all` (or after it, only for day view):
```typescript
const inventoryShortages = view === 'day'
	? await getInventoryShortagesForDate(dayDate)
	: [];
```

Add `inventoryShortages` to the return object.

- [ ] **Step 2: Show shortage badge in day view header**

In `src/routes/(app)/calendar/+page.svelte`, find the day view section header area (the part showing day summary bar, around line ~650). Add this badge after the day summary bar:

```svelte
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
```

- [ ] **Step 3: Verify in browser**

To test: create a pool-mode inventory item type with `totalPoolSize = 1`, then create a booking with 2 units allocated for today (or manually insert a second allocation row via the existing addAlloc form). Navigate to calendar day view for today — the amber warning banner should appear.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/calendar/+page.server.ts src/routes/\(app\)/calendar/+page.svelte
git commit -m "feat(calendar): add inventory shortage badge to day view header"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Button "crear reserva" | Task 1 |
| Popover generic component | Task 2 |
| SessionCardInfo shared sub-component | Task 3 |
| SessionCard compact (month) | Task 4 + 5 |
| SessionCard medium (week) | Task 4 + 6 |
| Desktop hover → popover, click → navigate | Task 4 |
| Touch tap → toggle popover | Task 4 |
| "Ver reserva" + "Ver día" buttons in popover | Task 4 |
| No schema migration for fuzzy | Tasks 7-11 (itemId IS NULL used as-is) |
| availability.ts utility | Task 7 |
| AllocationBadge component | Task 8 |
| Booking detail: pending badge + assign flow | Task 9 |
| Inventory detail: 14-day timeline | Task 10 |
| Calendar day: shortage badge | Task 11 |
| /bookings/new fuzzy creation | ⚠ Deferred to architecture session |

### Notes

- `calendar_view_day` i18n key added in Task 1 before it is used in Task 4. Tasks are ordered correctly.
- `AgendaSession` is used as the session type for `SessionCard`. Both month and week views use `data.rangedSessions` which is `AgendaSession[]`. No type mismatch.
- `data.availableItemsByType` in Task 9 may need variable name verification (Step 3 of Task 9). This is an existing variable loaded by the booking detail server — cross-check before assuming the name.
- Shortage badge in Task 11 links to `/inventory` (list page). Could link to a filtered view in future.
