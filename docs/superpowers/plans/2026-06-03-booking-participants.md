# Booking Participants — Who's Actually Doing the Activity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `booking_participants` table so operators can record who's actually doing the activity (the kids, the group members) separately from the billing contact (the enrolled client). Participants are managed at the booking level and appear per-session in the booking detail.

**Architecture:** New `booking_participants` table `(id, bookingId, name, notes, sortOrder)`. When sessions are created from a booking, participants auto-copy to `session_participants`. Booking create form gets an optional "Participants" section (when service requires participants — e.g., family/group). Booking detail shows participants per booking alongside per-session overrides. This is additive — existing session-level participant management is unchanged.

**Key design decision:** Participants live at the booking level as the default list. Each session gets its own `session_participants` copy (auto-populated from booking participants when sessions are created). The session-level copy can diverge from the booking-level list (different groups on different sessions is a valid use case).

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Drizzle ORM, PostgreSQL, Tailwind CSS v4

---

## File Map

**Create:**
- `drizzle/0026_booking_participants.sql`
- `src/lib/features/bookings/participants.queries.ts`

**Modify:**
- `src/lib/server/db/schema.ts` — add `bookingParticipants` table
- `src/lib/features/bookings/types.ts` — add `BookingParticipant` type, add `participants` to `Booking`
- `src/lib/features/bookings/queries.ts` — attach participants to `getBooking`, update `createBooking`
- `src/lib/features/sessions/queries.ts` — update `createSession` to auto-copy booking participants
- `src/routes/(app)/bookings/new/+page.server.ts` — store participants on create, pass to createSession
- `src/routes/(app)/bookings/new/+page.svelte` — optional Participants section
- `src/routes/(app)/bookings/[id]/+page.server.ts` — add `addParticipant`/`removeParticipant` booking-level actions
- `src/routes/(app)/bookings/[id]/+page.svelte` — Participants section in booking detail

---

### Task 1: Schema + migration

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0026_booking_participants.sql`

- [ ] **Step 1.1: Add `bookingParticipants` table to `src/lib/server/db/schema.ts`**

After `bookingClients` definition, add:

```typescript
export const bookingParticipants = pgTable('booking_participants', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	bookingId: text('booking_id')
		.notNull()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	notes: text('notes'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [
	index('idx_booking_participants_booking').on(t.bookingId)
]);
```

- [ ] **Step 1.2: Create `drizzle/0026_booking_participants.sql`**

```sql
CREATE TABLE IF NOT EXISTS booking_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_participants_booking ON booking_participants(booking_id);
```

- [ ] **Step 1.3: Apply migration to local DB**

```bash
node --env-file=.env -e "
const {default: postgres} = await import('postgres');
const {default: fs} = await import('fs');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
try {
  await sql.unsafe(fs.readFileSync('drizzle/0026_booking_participants.sql', 'utf-8'));
  await sql\`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0026_booking_participants.sql', \${Date.now()}) ON CONFLICT (hash) DO NOTHING\`;
  console.log('Applied');
} catch(e) { console.error(e.message, e.code); } finally { await sql.end(); }
" --input-type=module
```

Expected: `Applied`

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/0026_booking_participants.sql
git commit -m "feat: schema + migration — booking_participants table"
```

---

### Task 2: Types + queries

**Files:**
- Modify: `src/lib/features/bookings/types.ts`
- Create: `src/lib/features/bookings/participants.queries.ts`

- [ ] **Step 2.1: Add `BookingParticipant` to `src/lib/features/bookings/types.ts`**

Add after `BookingClient`:

```typescript
export interface BookingParticipant {
	id: string;
	bookingId: string;
	name: string;
	notes: string | null;
	sortOrder: number;
	createdAt: Date;
}
```

Add `participants: BookingParticipant[]` to `Booking`:
```typescript
	participants: BookingParticipant[];
```

- [ ] **Step 2.2: Create `src/lib/features/bookings/participants.queries.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingParticipants } from '$lib/server/db/schema';
import type { BookingParticipant } from './types';

export async function listParticipantsForBooking(bookingId: string): Promise<BookingParticipant[]> {
	return db
		.select()
		.from(bookingParticipants)
		.where(eq(bookingParticipants.bookingId, bookingId))
		.orderBy(bookingParticipants.sortOrder, bookingParticipants.createdAt);
}

export async function addBookingParticipant(
	bookingId: string,
	name: string,
	notes?: string | null
): Promise<BookingParticipant> {
	const existing = await listParticipantsForBooking(bookingId);
	const [row] = await db
		.insert(bookingParticipants)
		.values({ bookingId, name, notes: notes ?? null, sortOrder: existing.length })
		.returning();
	return row;
}

export async function removeBookingParticipant(id: string): Promise<void> {
	await db.delete(bookingParticipants).where(eq(bookingParticipants.id, id));
}

export async function bulkAddBookingParticipants(
	bookingId: string,
	names: string[]
): Promise<void> {
	if (names.length === 0) return;
	await db.insert(bookingParticipants).values(
		names.map((name, i) => ({ bookingId, name, sortOrder: i }))
	);
}
```

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/features/bookings/types.ts src/lib/features/bookings/participants.queries.ts
git commit -m "feat: booking participants — types and queries"
```

---

### Task 3: Attach participants to `getBooking`

**Files:**
- Modify: `src/lib/features/bookings/queries.ts`

- [ ] **Step 3.1: Update `getBooking` to attach participants**

Add import at top:
```typescript
import { listParticipantsForBooking } from './participants.queries';
```

At the end of `getBooking`, before `return`:
```typescript
	// Attach booking-level participants
	const participants = await listParticipantsForBooking(booking.id);
	return { ...booking, participants };
```

The `Booking` type already has `participants: BookingParticipant[]` after Task 2.

- [ ] **Step 3.2: Run type check**

```bash
pnpm check 2>&1 | grep "Error" | grep -v WARNING | head -20
```

Fix any issues. Most likely: `BookingListItem` and `BookingSummary` don't have `participants` — that's fine, only `Booking` (the full detail type) needs it.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/features/bookings/queries.ts
git commit -m "feat: getBooking — attach booking-level participants"
```

---

### Task 4: Auto-copy participants to sessions on booking create

**Files:**
- Modify: `src/lib/features/sessions/queries.ts`

- [ ] **Step 4.1: Update `createSession` to accept and add participants**

In `src/lib/features/sessions/queries.ts`, find the `CreateSessionInput` type import. In the `createSession` function, check if the session's booking has participants and auto-add them.

The cleanest place is in the booking create server, not `createSession` itself — because `createSession` doesn't know about booking participants. Instead:

In `src/routes/(app)/bookings/new/+page.server.ts`, after creating sessions in the `hasSessions` branch:

```typescript
			// Auto-copy booking participants to each session
			const participantNames = form.getAll('participantName')
				.map(n => n.toString().trim())
				.filter(Boolean);

			if (participantNames.length > 0) {
				await bulkAddBookingParticipants(booking.id, participantNames);

				// Add to each created session
				await Promise.all(
					createdSessionIds.map(sessionId =>
						Promise.all(
							participantNames.map((name, i) =>
								addParticipant({ sessionId, name })
							)
						)
					)
				);
			}
```

This requires storing `createdSessionIds`. Update the sessions creation block to capture IDs:

```typescript
			const createdSessions = await Promise.all(
				Array.from({ length: sessionsIncluded }, (_, i) =>
					createSession({
						bookingId: booking.id,
						date,
						time: i === 0 && !isFlexible ? time : undefined,
						sortOrder: i
					})
				)
			);
			const createdSessionIds = createdSessions.map(s => s.id);
```

Add imports at top of `+page.server.ts`:
```typescript
import { bulkAddBookingParticipants } from '$lib/features/bookings/participants.queries';
import { addParticipant } from '$lib/features/sessions/queries';
```

Note: `createSession` currently returns `void`. Check `src/lib/features/sessions/queries.ts` — if it doesn't return the created session, update it to return `Session`. Find the `createSession` function and ensure it returns the created row:

```typescript
export async function createSession(input: CreateSessionInput): Promise<Session> {
	const [sessionRow] = await db.insert(sessions).values({...}).returning();
	// ... link to booking
	return sessionRow as Session;
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/lib/features/sessions/queries.ts src/routes/(app)/bookings/new/+page.server.ts
git commit -m "feat: booking create — auto-copy participants to sessions"
```

---

### Task 5: Booking create form — participants section

**Files:**
- Modify: `src/routes/(app)/bookings/new/+page.svelte`

- [ ] **Step 5.1: Add participants input to the booking create form**

In the svelte page, add a reactive participants array in the `<script>`:

```typescript
	let participants = $state<string[]>([]);
	function addParticipantField() { participants = [...participants, '']; }
	function removeParticipantField(i: number) { participants = participants.filter((_, idx) => idx !== i); }
```

After the client selection section in the form, add an optional Participants section. Show it when the service requires it (non-trivial to auto-detect, so show for all session-based and roster services):

```svelte
{#if selectedService?.hasSessions || selectedService?.hasRoster}
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-gray-700">
        Participants <span class="text-muted">(optional — who will do the activity)</span>
      </p>
      <button type="button" onclick={addParticipantField} class="text-xs text-ocean hover:underline">
        + Add participant
      </button>
    </div>
    <p class="mb-2 text-xs text-muted">Use when the client is a parent or group organiser, not the actual participant.</p>
    {#each participants as _, i}
      <div class="mb-2 flex gap-2">
        <input
          type="text"
          name="participantName"
          bind:value={participants[i]}
          class="input flex-1"
          placeholder="e.g. Sarah Smith (9 years old)"
        />
        <button type="button" onclick={() => removeParticipantField(i)} class="text-muted hover:text-red-500">✕</button>
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 5.2: Commit**

```bash
git add "src/routes/(app)/bookings/new/+page.svelte"
git commit -m "feat: booking create — optional participants section"
```

---

### Task 6: Booking detail — participants section + actions

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 6.1: Add booking-level participant actions to `src/routes/(app)/bookings/[id]/+page.server.ts`**

Add imports:
```typescript
import { addBookingParticipant, removeBookingParticipant } from '$lib/features/bookings/participants.queries';
import { addParticipant } from '$lib/features/sessions/queries';
```

Add actions:
```typescript
	addBookingParticipant: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const addToSessions = form.get('addToSessions') === 'true';
		if (!name) return fail(400, { error: 'Name is required' });
		await addBookingParticipant(params.id, name);
		if (addToSessions) {
			const sessions = await listSessionsForBooking(params.id);
			await Promise.all(sessions.map(s => addParticipant({ sessionId: s.id, name })));
		}
		return { error: null, message: 'Participant added' };
	},

	removeBookingParticipant: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const id = form.get('participantId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Missing participant id' });
		await removeBookingParticipant(id);
		return { error: null, message: 'Participant removed' };
	},
```

- [ ] **Step 6.2: Add Participants section to `src/routes/(app)/bookings/[id]/+page.svelte`**

Add a "Participants" section after the Clients section. Place it before the Sessions section. The `data.booking.participants` array is available.

```svelte
<!-- Participants (people doing the activity, may differ from billing client) -->
{#if data.booking.serviceHasSessions || data.booking.serviceHasRoster}
  <section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Participants</h2>
    <p class="mb-3 text-xs text-muted">People who will actually do the activity (not the billing contact).</p>

    {#if data.booking.participants.length > 0}
      <ul class="mb-3 space-y-1">
        {#each data.booking.participants as p}
          <li class="flex items-center justify-between">
            <span class="text-sm text-gray-800">{p.name}</span>
            <form method="POST" action="?/removeBookingParticipant" use:enhance={withToast()}>
              <input type="hidden" name="participantId" value={p.id} />
              <button type="submit" class="text-xs text-muted hover:text-red-500">✕</button>
            </form>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mb-3 text-xs text-muted">No participants recorded.</p>
    {/if}

    <form method="POST" action="?/addBookingParticipant" use:enhance={withToast()} class="flex flex-col gap-2">
      <div class="flex gap-2">
        <input name="name" type="text" placeholder="Add participant name…" class="input input-sm flex-1" />
        <button type="submit" class="btn-primary btn-sm">Add</button>
      </div>
      <label class="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="addToSessions" value="true" class="h-3.5 w-3.5" />
        Also add to all sessions of this booking
      </label>
    </form>
  </section>
{/if}
```

- [ ] **Step 6.3: Commit**

```bash
git add "src/routes/(app)/bookings/[id]/"
git commit -m "feat: booking detail — participants section (add/remove, sync to sessions)"
```

---

### Task 7: Type check + polish

- [ ] **Step 7.1: Run full type check**

```bash
pnpm check 2>&1 | grep "Error" | grep -v WARNING | head -30
```

- [ ] **Step 7.2: Fix any type errors**

Common issues:
- `data.booking.participants` not available in `BookingSummary` (only `Booking`) — ensure the booking detail page uses the `Booking` type, not `BookingSummary`
- `createSession` return type — update if needed to return `Session`

- [ ] **Step 7.3: Final commit**

```bash
git add -A
git commit -m "feat: booking participants — complete feature (schema, queries, create form, detail page)"
```

---
