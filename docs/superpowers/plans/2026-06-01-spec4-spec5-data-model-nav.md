# Spec-4 + Spec-5: Data Model Corrections & Navigation Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the instructor-at-booking-level redundancy, add per-session participant names, and restructure navigation so Calendar = sessions only, Today = operational briefing, Bookings = commercial list with its own dedicated page.

**Architecture:** Two independent phases. Phase 1 (spec-4) fixes the data model: drops `bookings.instructor_id`, routes all non-session instructor assignment through the existing `booking_instructors` junction, and adds a `session_participants` table for lightweight per-session attendee names. Phase 2 (spec-5) restructures the nav and views: adds a `/bookings` list page, renames Agenda→Today with sessions-only content, and strips booking-level data from the Calendar month/week views.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind CSS v4, Drizzle ORM + PostgreSQL, Lucide Svelte icons.

---

## File Map

### Phase 1 — Data model

| File | Action | Purpose |
|------|--------|---------|
| `drizzle/0017_drop_booking_instructor_id.sql` | Create | Migrate instructor_id data → booking_instructors, drop column |
| `drizzle/0018_session_participants.sql` | Create | Add session_participants table |
| `drizzle/meta/0017_snapshot.json` | Create | Drizzle migration snapshot |
| `drizzle/meta/0018_snapshot.json` | Create | Drizzle migration snapshot |
| `drizzle/meta/_journal.json` | Modify | Add both migration entries |
| `src/lib/server/db/schema.ts` | Modify | Remove `instructorId` from bookings, add `sessionParticipants` table |
| `src/lib/features/bookings/types.ts` | Modify | Remove instructorId from Booking/BookingSummary/CreateBookingInput/UpdateBookingInput; remove from non-session context |
| `src/lib/features/sessions/types.ts` | Modify | Add `SessionParticipant` interface; add `participants` to `Session`; replace `clientName`/`clientNames` with `participantNames` in enriched types |
| `src/lib/features/bookings/queries.ts` | Modify | Replace instructor join with bookingInstructors two-step lookup; update createBooking/updateBooking |
| `src/lib/features/sessions/queries.ts` | Modify | Add participant CRUD; attach participants to Session/SessionForDay/AgendaSession |
| `src/routes/(app)/bookings/new/+page.server.ts` | Modify | Remove instructorId from hasSessions booking path |
| `src/routes/(app)/bookings/new/+page.svelte` | Modify | Hide instructor dropdown when hasSessions=true |
| `src/routes/(app)/bookings/[id]/+page.server.ts` | Modify | Add addParticipant/removeParticipant actions |
| `src/routes/(app)/bookings/[id]/+page.svelte` | Modify | Add per-session participant section; hide booking-level instructor for session services |

### Phase 2 — Navigation

| File | Action | Purpose |
|------|--------|---------|
| `src/routes/(app)/bookings/+page.server.ts` | Create | Load all bookings with session counts |
| `src/routes/(app)/bookings/+page.svelte` | Create | Bookings list UI |
| `src/lib/features/bookings/queries.ts` | Modify | Add `listAllBookings()` with sessionCount |
| `src/lib/features/bookings/types.ts` | Modify | Add `BookingListItem` type |
| `src/routes/(app)/agenda/+page.server.ts` | Modify | Remove nonSessionBookings; add today sessions and alert counts only |
| `src/routes/(app)/agenda/+page.svelte` | Modify | Strip booking cards; sessions-only; rename to "Today" in heading |
| `src/routes/(app)/calendar/+page.server.ts` | Modify | Month/week: fetch sessions for dots (not bookings) |
| `src/routes/(app)/calendar/+page.svelte` | Modify | Month/week dots = session counts; remove booking bars from week |
| `src/lib/components/nav/BottomNav.svelte` | Modify | Add Bookings tab, rename Agenda→Today |
| `src/lib/components/nav/Sidebar.svelte` | Modify | Add Bookings, rename Agenda→Today |

---

## Phase 1 — Data Model

---

### Task 1: SQL migrations

**Files:**
- Create: `drizzle/0017_drop_booking_instructor_id.sql`
- Create: `drizzle/0018_session_participants.sql`
- Modify: `drizzle/meta/_journal.json`

- [ ] **Step 1: Write migration 0017**

```sql
-- drizzle/0017_drop_booking_instructor_id.sql
-- Preserve existing instructor assignments: migrate to booking_instructors junction
INSERT INTO booking_instructors (id, booking_id, instructor_id)
SELECT gen_random_uuid()::text, id, instructor_id
FROM bookings
WHERE instructor_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "bookings" DROP COLUMN "instructor_id";
```

- [ ] **Step 2: Write migration 0018**

```sql
-- drizzle/0018_session_participants.sql
CREATE TABLE "session_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "session_participants_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id")
    ON DELETE cascade ON UPDATE no action
);
```

- [ ] **Step 3: Update _journal.json**

Add two entries after the existing `idx: 16` entry:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    ...existing entries...,
    {
      "idx": 17,
      "version": "7",
      "when": 1748822400000,
      "tag": "0017_drop_booking_instructor_id",
      "breakpoints": true
    },
    {
      "idx": 18,
      "version": "7",
      "when": 1748822401000,
      "tag": "0018_session_participants",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: Apply migrations to local DB**

```bash
npx drizzle-kit migrate
```

Expected: migrations 0017 and 0018 applied successfully.

- [ ] **Step 5: Create snapshot stubs**

Create `drizzle/meta/0017_snapshot.json` and `drizzle/meta/0018_snapshot.json` — run `npx drizzle-kit generate` after schema changes in Task 2 to auto-generate these, or create minimal stubs matching the Drizzle snapshot format. If running generate, it will overwrite the stubs.

- [ ] **Step 6: Commit**

```bash
git add drizzle/
git commit -m "feat(spec-4): migrations — drop bookings.instructor_id, add session_participants"
```

---

### Task 2: Drizzle schema

**Files:**
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Remove `instructorId` from bookings table**

In `src/lib/server/db/schema.ts`, find the `bookings` table definition and remove:

```ts
// REMOVE this line:
instructorId: text('instructor_id').references(() => instructors.id),
```

- [ ] **Step 2: Add `sessionParticipants` table**

After the `sessionInstructors` table definition, add:

```ts
export const sessionParticipants = pgTable('session_participants', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	notes: text('notes'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

Expected: 0 errors (or only pre-existing auth-seed/reset-auth errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(spec-4): schema — remove bookings.instructor_id, add session_participants table"
```

---

### Task 3: Types

**Files:**
- Modify: `src/lib/features/bookings/types.ts`
- Modify: `src/lib/features/sessions/types.ts`

- [ ] **Step 1: Update booking types**

Replace the full content of `src/lib/features/bookings/types.ts`:

```ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface BookingClient {
	id: string;
	bookingId: string;
	clientId: string;
	clientFirstName: string;
	clientLastName: string;
	clientPhone: string | null;
	clientEmail: string | null;
	status: 'enrolled' | 'cancelled';
	amountDue: string;
	amountPaid: string;
	paymentStatus: PaymentStatus;
	cancelledAt: Date | null;
}

export type BookingSource = 'admin' | 'whatsapp_bot';

export interface Booking {
	id: string;
	serviceId: string | null;
	serviceName: string | null;
	serviceType: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceHasRoster: boolean;
	serviceMaxCapacity: number | null;
	// Instructor for non-session services (rentals, products, accommodation)
	// null for session-based services — instructor lives on sessions
	instructorId: string | null;
	instructorName: string | null;
	accommodationUnitId: string | null;
	accommodationUnitName: string | null;
	accommodationUnitTypeName: string | null;
	guestsCount: number | null;
	date: string;
	dateEnd: string | null;
	time: string | null;
	sessionsIncluded: number | null;
	isFlexible: boolean;
	status: BookingStatus;
	source: BookingSource;
	spotNotes: string | null;
	notes: string | null;
	clients: BookingClient[];
	createdAt: Date;
	updatedAt: Date;
}

export interface BookingSummary {
	id: string;
	serviceName: string | null;
	serviceType: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceHasRoster: boolean;
	serviceHasDateRange: boolean;
	serviceHasInventoryUnits: boolean;
	serviceRequiresInstructor: boolean;
	serviceMaxCapacity: number | null;
	// Instructor for non-session services only
	instructorName: string | null;
	accommodationUnitName: string | null;
	accommodationUnitTypeName: string | null;
	guestsCount: number | null;
	date: string;
	dateEnd: string | null;
	time: string | null;
	sessionsIncluded: number | null;
	isFlexible: boolean;
	status: BookingStatus;
	clientCount: number;
	firstClientName: string | null;
}

/** Extended summary used in the /bookings list page. */
export interface BookingListItem extends BookingSummary {
	sessionCount: number;
	scheduledCount: number;
}

export interface ClientBookingSummary {
	id: string;
	date: string;
	time: string | null;
	serviceName: string | null;
	status: BookingStatus;
}

export interface CreateBookingInput {
	serviceId: string;
	/** For non-session services (rentals, products, accommodation) only */
	instructorId?: string;
	accommodationUnitId?: string;
	guestsCount?: number;
	date: string;
	dateEnd?: string;
	/** For non-session services only */
	time?: string;
	sessionsIncluded?: number;
	isFlexible: boolean;
	status?: BookingStatus;
	source?: BookingSource;
	spotNotes?: string;
	notes?: string;
	clients: {
		clientId: string;
		amountDue: string;
	}[];
}

export interface UpdateBookingInput {
	/** For non-session services only */
	instructorId?: string | null;
	date?: string;
	dateEnd?: string | null;
	/** For non-session services only */
	time?: string | null;
	sessionsIncluded?: number | null;
	isFlexible?: boolean;
	status?: BookingStatus;
	spotNotes?: string | null;
	notes?: string | null;
}
```

- [ ] **Step 2: Update session types**

Replace the full content of `src/lib/features/sessions/types.ts`:

```ts
export type SessionStatus = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';

export interface SessionInstructor {
	id: string;
	sessionId: string;
	instructorId: string;
	instructorName: string | null;
}

export interface SessionParticipant {
	id: string;
	sessionId: string;
	name: string;
	notes: string | null;
	sortOrder: number;
}

// Pure session row — no booking context.
export interface Session {
	id: string;
	date: string;
	time: string | null;
	durationMinutes: number | null;
	notes: string | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	participants: SessionParticipant[];
	createdAt: Date;
	updatedAt: Date;
}

// Session enriched with booking context for the calendar day view.
export interface SessionForDay extends Session {
	bookingId: string;
	bookingIds: string[];
	bookingStatus: string;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	// Who attends: from session_participants if set, otherwise booking client names
	participantNames: string[];
	totalParticipants: number;
}

// Session enriched for the Today/Agenda view.
export interface AgendaSession extends Session {
	bookingId: string;
	bookingIds: string[];
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasRoster: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	sessionsIncluded: number | null;
	bookingStatus: string;
	bookingDate: string;
	bookingDateEnd: string | null;
	isFlexible: boolean;
	// Who attends: from session_participants if set, otherwise first booking client
	participantNames: string[];
	// For camps (roster): enrollment aggregate
	enrolledCount: number;
	maxCapacity: number | null;
}

export interface CreateSessionInput {
	bookingId: string;
	date: string;
	time?: string;
	durationMinutes?: number;
	notes?: string;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	durationMinutes?: number | null;
	notes?: string | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface CreateParticipantInput {
	sessionId: string;
	name: string;
	notes?: string;
	sortOrder?: number;
}
```

- [ ] **Step 3: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

Expected: errors now because queries haven't been updated yet — that's fine, note them.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/bookings/types.ts src/lib/features/sessions/types.ts
git commit -m "feat(spec-4): types — BookingListItem, SessionParticipant, participantNames replaces clientNames"
```

---

### Task 4: Booking queries

**Files:**
- Modify: `src/lib/features/bookings/queries.ts`

The core change: replace the `LEFT JOIN instructors ON bookings.instructor_id = instructors.id` pattern with a two-step lookup via `bookingInstructors`. This avoids fanout rows in the main query.

- [ ] **Step 1: Update imports at top of file**

Ensure `bookingInstructors` is imported from schema (it already exists in schema.ts):

```ts
import {
	bookings,
	bookingClients,
	bookingInstructors,
	clients,
	services,
	instructors,
	accommodationUnits,
	accommodationUnitTypes
} from '$lib/server/db/schema';
```

- [ ] **Step 2: Add `attachInstructorsToBookings` helper**

Add this helper function near the top of `queries.ts`, after existing imports:

```ts
/** Fetch first instructor name per booking from booking_instructors junction. */
async function attachInstructorsToBookings<T extends { id: string }>(
	rows: T[]
): Promise<(T & { instructorId: string | null; instructorName: string | null })[]> {
	if (rows.length === 0) return rows.map(r => ({ ...r, instructorId: null, instructorName: null }));

	const ids = rows.map(r => r.id);
	const instrRows = await db
		.select({
			bookingId: bookingInstructors.bookingId,
			instructorId: bookingInstructors.instructorId,
			instructorName: instructors.name
		})
		.from(bookingInstructors)
		.leftJoin(instructors, eq(bookingInstructors.instructorId, instructors.id))
		.where(inArray(bookingInstructors.bookingId, ids));

	const byBooking: Record<string, { instructorId: string; instructorName: string | null }> = {};
	for (const r of instrRows) {
		if (!byBooking[r.bookingId]) {
			byBooking[r.bookingId] = { instructorId: r.instructorId, instructorName: r.instructorName };
		}
	}

	return rows.map(r => ({
		...r,
		instructorId: byBooking[r.id]?.instructorId ?? null,
		instructorName: byBooking[r.id]?.instructorName ?? null
	}));
}
```

- [ ] **Step 3: Update `listBookingsForDateRange`**

Replace the `.select({...})` block and joins — remove the instructor join, use the helper instead:

```ts
export async function listBookingsForDateRange(from: string, to: string): Promise<BookingSummary[]> {
	const rows = await db
		.select({
			id: bookings.id,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceHasDateRange: services.hasDateRange,
			serviceHasInventoryUnits: services.hasInventoryUnits,
			serviceRequiresInstructor: services.requiresInstructor,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		.where(and(
			lte(bookings.date, to),
			gte(sql`COALESCE(${bookings.dateEnd}, ${bookings.date})`, from)
		))
		.orderBy(bookings.date, bookings.time);

	const withInstructors = await attachInstructorsToBookings(rows);

	const ids = withInstructors.map(r => r.id);
	const counts: Record<string, number> = {};
	const firstClientNames: Record<string, string> = {};
	if (ids.length > 0) {
		const clientRows = await db
			.select({
				bookingId: bookingClients.bookingId,
				firstName: clients.firstName
			})
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(inArray(bookingClients.bookingId, ids));
		for (const row of clientRows) {
			counts[row.bookingId] = (counts[row.bookingId] ?? 0) + 1;
			if (!firstClientNames[row.bookingId] && row.firstName) {
				firstClientNames[row.bookingId] = row.firstName;
			}
		}
	}

	return withInstructors.map(r => ({
		...r,
		clientCount: counts[r.id] ?? 0,
		firstClientName: firstClientNames[r.id] ?? null
	})) as BookingSummary[];
}
```

- [ ] **Step 4: Update `getBooking`**

Replace the instructor join in `getBooking` to use `bookingInstructors`. In the `.select({...})` block, remove:
```ts
instructorId: bookings.instructorId,
instructorName: instructors.name,
```

Remove `.leftJoin(instructors, eq(bookings.instructorId, instructors.id))`.

After fetching the booking row, add the instructor lookup:

```ts
export async function getBooking(id: string): Promise<Booking | undefined> {
	const [booking] = await db
		.select({
			id: bookings.id,
			serviceId: bookings.serviceId,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitId: bookings.accommodationUnitId,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status,
			source: bookings.source,
			spotNotes: bookings.spotNotes,
			notes: bookings.notes,
			createdAt: bookings.createdAt,
			updatedAt: bookings.updatedAt
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		.where(eq(bookings.id, id));

	if (!booking) return undefined;

	const [instrRow] = await db
		.select({ instructorId: bookingInstructors.instructorId, instructorName: instructors.name })
		.from(bookingInstructors)
		.leftJoin(instructors, eq(bookingInstructors.instructorId, instructors.id))
		.where(eq(bookingInstructors.bookingId, id))
		.limit(1);

	const bookingClientRows = await db
		.select({
			id: bookingClients.id,
			bookingId: bookingClients.bookingId,
			clientId: bookingClients.clientId,
			clientFirstName: clients.firstName,
			clientLastName: clients.lastName,
			clientPhone: clients.phone,
			clientEmail: clients.email,
			status: bookingClients.status,
			amountDue: bookingClients.amountDue,
			amountPaid: bookingClients.amountPaid,
			paymentStatus: bookingClients.paymentStatus,
			cancelledAt: bookingClients.cancelledAt
		})
		.from(bookingClients)
		.leftJoin(clients, eq(bookingClients.clientId, clients.id))
		.where(eq(bookingClients.bookingId, id));

	return {
		...booking,
		instructorId: instrRow?.instructorId ?? null,
		instructorName: instrRow?.instructorName ?? null,
		clients: bookingClientRows
	} as Booking;
}
```

- [ ] **Step 5: Update `createBooking`**

Remove `instructorId` from the `.values({...})` insert. After inserting the booking, write to `bookingInstructors` if `instructorId` provided:

```ts
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
	const [booking] = await db
		.insert(bookings)
		.values({
			serviceId: input.serviceId,
			accommodationUnitId: input.accommodationUnitId,
			guestsCount: input.guestsCount,
			date: input.date,
			dateEnd: input.dateEnd,
			time: input.time,
			sessionsIncluded: input.sessionsIncluded,
			isFlexible: input.isFlexible,
			status: input.status ?? (input.source === 'whatsapp_bot' ? 'pending' : 'confirmed'),
			source: input.source ?? 'admin',
			spotNotes: input.spotNotes,
			notes: input.notes
		})
		.returning();

	if (input.instructorId) {
		await db.insert(bookingInstructors).values({
			bookingId: booking.id,
			instructorId: input.instructorId
		});
	}

	if (input.clients.length > 0) {
		await db.insert(bookingClients).values(
			input.clients.map((c) => ({
				bookingId: booking.id,
				clientId: c.clientId,
				amountDue: c.amountDue,
				amountPaid: '0',
				paymentStatus: 'pending' as const
			}))
		);
	}

	return (await getBooking(booking.id))!;
}
```

- [ ] **Step 6: Update `updateBooking`**

Find `updateBooking` function. Remove `instructorId` from the `db.update` call. Add instructor update via `bookingInstructors`:

```ts
export async function updateBooking(id: string, input: UpdateBookingInput): Promise<void> {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (input.date !== undefined)      updates.date = input.date;
	if (input.dateEnd !== undefined)   updates.dateEnd = input.dateEnd;
	if (input.time !== undefined)      updates.time = input.time;
	if (input.sessionsIncluded !== undefined) updates.sessionsIncluded = input.sessionsIncluded;
	if (input.isFlexible !== undefined) updates.isFlexible = input.isFlexible;
	if (input.status !== undefined)    updates.status = input.status;
	if (input.spotNotes !== undefined) updates.spotNotes = input.spotNotes;
	if (input.notes !== undefined)     updates.notes = input.notes;

	await db.update(bookings).set(updates).where(eq(bookings.id, id));

	if (input.instructorId !== undefined) {
		await db.delete(bookingInstructors).where(eq(bookingInstructors.bookingId, id));
		if (input.instructorId) {
			await db.insert(bookingInstructors).values({ bookingId: id, instructorId: input.instructorId });
		}
	}
}
```

- [ ] **Step 7: Add `listAllBookings`**

Add after the existing `listBookingsForDateRange`:

```ts
export async function listAllBookings(): Promise<BookingListItem[]> {
	const rows = await db
		.select({
			id: bookings.id,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceHasDateRange: services.hasDateRange,
			serviceHasInventoryUnits: services.hasInventoryUnits,
			serviceRequiresInstructor: services.requiresInstructor,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		.orderBy(desc(bookings.date));

	const withInstructors = await attachInstructorsToBookings(rows);
	const ids = withInstructors.map(r => r.id);
	if (ids.length === 0) return [];

	const [clientRows, sessionRows] = await Promise.all([
		db.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName })
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(inArray(bookingClients.bookingId, ids)),
		db.select({
			bookingId: bookingSessions.bookingId,
			sessionId: bookingSessions.sessionId,
			status: sessions.status
		})
			.from(bookingSessions)
			.leftJoin(sessions, eq(bookingSessions.sessionId, sessions.id))
			.where(inArray(bookingSessions.bookingId, ids))
	]);

	const counts: Record<string, number> = {};
	const firstClientNames: Record<string, string> = {};
	for (const r of clientRows) {
		counts[r.bookingId] = (counts[r.bookingId] ?? 0) + 1;
		if (!firstClientNames[r.bookingId] && r.firstName) firstClientNames[r.bookingId] = r.firstName;
	}

	const sessionCounts: Record<string, number> = {};
	const scheduledCounts: Record<string, number> = {};
	for (const r of sessionRows) {
		sessionCounts[r.bookingId] = (sessionCounts[r.bookingId] ?? 0) + 1;
		if (r.status === 'scheduled') scheduledCounts[r.bookingId] = (scheduledCounts[r.bookingId] ?? 0) + 1;
	}

	return withInstructors.map(r => ({
		...r,
		clientCount: counts[r.id] ?? 0,
		firstClientName: firstClientNames[r.id] ?? null,
		sessionCount: sessionCounts[r.id] ?? 0,
		scheduledCount: scheduledCounts[r.id] ?? 0
	})) as BookingListItem[];
}
```

Also add `bookingSessions` and `sessions` to the imports at the top of `queries.ts` if not already present.

- [ ] **Step 8: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/bookings/queries.ts
git commit -m "feat(spec-4): booking queries — instructor via bookingInstructors junction, add listAllBookings"
```

---

### Task 5: Session participant queries

**Files:**
- Modify: `src/lib/features/sessions/queries.ts`

- [ ] **Step 1: Add `sessionParticipants` to imports**

At the top of `src/lib/features/sessions/queries.ts`, add `sessionParticipants` to the schema import:

```ts
import {
	sessions,
	bookingSessions,
	sessionInstructors,
	sessionParticipants,
	instructors,
	bookings,
	bookingClients,
	clients,
	services
} from '$lib/server/db/schema';
import type {
	AgendaSession,
	CreateParticipantInput,
	CreateSessionInput,
	Session,
	SessionForDay,
	SessionParticipant,
	SessionInstructor,
	UpdateSessionInput
} from './types';
```

- [ ] **Step 2: Add `attachParticipants` helper**

Add after `attachInstructors`:

```ts
async function attachParticipants<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { participants: SessionParticipant[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, participants: [] }));

	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionParticipants.id,
			sessionId: sessionParticipants.sessionId,
			name: sessionParticipants.name,
			notes: sessionParticipants.notes,
			sortOrder: sessionParticipants.sortOrder
		})
		.from(sessionParticipants)
		.where(sql`${sessionParticipants.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`)
		.orderBy(sessionParticipants.sortOrder);

	const bySession: Record<string, SessionParticipant[]> = {};
	for (const r of rows) {
		(bySession[r.sessionId] ??= []).push(r);
	}
	return sessionRows.map(s => ({ ...s, participants: bySession[s.id] ?? [] }));
}
```

- [ ] **Step 3: Update `attachInstructors` return to also attach participants**

Replace calls to `attachInstructors(...)` with a combined helper. Actually, keep them separate — call both in sequence where needed. Update each query that builds a `Session` to call `attachParticipants` after `attachInstructors`.

In `listSessionsForBooking`, replace:
```ts
return attachInstructors(rows as Omit<Session, 'instructors'>[]);
```
with:
```ts
const withInstructors = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
return attachParticipants(withInstructors);
```

In `getSession`, replace similarly:
```ts
const [withInstructors] = await attachInstructors([row as Omit<Session, 'instructors'>]);
return withInstructors;
```
with:
```ts
const [withInstructors] = await attachInstructors([row as Omit<Session, 'instructors' | 'participants'>]);
const [withBoth] = await attachParticipants([withInstructors]);
return withBoth;
```

- [ ] **Step 4: Update `listSessionsForDate` to include participants and use `participantNames`**

In the final `.map(s => {...})` block, replace `clientNames` and `totalClients`:

```ts
// After getting withInstructors, also attach participants:
const withBoth = await attachParticipants(withInstructors);

return withBoth
	.filter(s => (linksBySession[s.id] ?? []).length > 0)
	.map(s => {
		const sl = linksBySession[s.id]!;
		const firstLink = sl[0];
		const allClientNames = sl.flatMap(l => clientsByBooking[l.bookingId] ?? []);
		const svcDuration = firstLink.serviceDurationMinutes ?? null;

		// Prefer explicit session_participants; fall back to booking client names
		const participantNames = s.participants.length > 0
			? s.participants.map(p => p.name)
			: allClientNames;

		return {
			...s,
			bookingId: firstLink.bookingId ?? '',
			bookingIds: sl.map(l => l.bookingId),
			bookingStatus: firstLink.bookingStatus ?? 'pending',
			serviceName: firstLink.serviceName ?? null,
			serviceColor: firstLink.serviceColor ?? null,
			serviceHasSessions: firstLink.serviceHasSessions ?? false,
			serviceDurationMinutes: svcDuration,
			effectiveDuration: s.durationMinutes ?? svcDuration ?? 60,
			participantNames,
			totalParticipants: participantNames.length
		} satisfies SessionForDay;
	});
```

- [ ] **Step 5: Update `listSessionsForDateRange` (Agenda/Today) to include participants and use `participantNames`**

In the final `.map(s => {...})` block, replace `clientName`/`clientPhone`:

```ts
const withBoth = await attachParticipants(withInstructors);

return withBoth
	.filter(s => (linksBySession[s.id] ?? []).length > 0)
	.map(s => {
		const sl = linksBySession[s.id]!;
		const first = sl[0];
		const bClients = sl.flatMap(l => clientsByBooking[l.bookingId] ?? []);
		const svcDuration = first.serviceDurationMinutes ?? null;

		const participantNames = s.participants.length > 0
			? s.participants.map(p => p.name)
			: first.serviceHasRoster
				? []
				: bClients.map(c => `${c.firstName} ${c.lastName}`);

		return {
			...s,
			bookingId: first.bookingId ?? '',
			bookingIds: sl.map(l => l.bookingId).filter(Boolean) as string[],
			serviceName: first.serviceName,
			serviceColor: first.serviceColor,
			serviceHasRoster: first.serviceHasRoster ?? false,
			serviceDurationMinutes: svcDuration,
			effectiveDuration: s.durationMinutes ?? svcDuration ?? 60,
			sessionsIncluded: first.sessionsIncluded,
			bookingStatus: first.bookingStatus ?? 'pending',
			bookingDate: first.bookingDate ?? s.date,
			bookingDateEnd: first.bookingDateEnd,
			isFlexible: first.isFlexible ?? false,
			participantNames,
			enrolledCount: bClients.length,
			maxCapacity: first.serviceMaxCapacity
		} satisfies AgendaSession;
	});
```

- [ ] **Step 6: Add participant CRUD functions**

Append to `queries.ts`:

```ts
// ── Session participants ──────────────────────────────────────────────────────

export async function listParticipantsForSession(sessionId: string): Promise<SessionParticipant[]> {
	return db
		.select({
			id: sessionParticipants.id,
			sessionId: sessionParticipants.sessionId,
			name: sessionParticipants.name,
			notes: sessionParticipants.notes,
			sortOrder: sessionParticipants.sortOrder
		})
		.from(sessionParticipants)
		.where(eq(sessionParticipants.sessionId, sessionId))
		.orderBy(sessionParticipants.sortOrder);
}

export async function addParticipant(input: CreateParticipantInput): Promise<SessionParticipant> {
	const [row] = await db
		.insert(sessionParticipants)
		.values({
			id: crypto.randomUUID(),
			sessionId: input.sessionId,
			name: input.name.trim(),
			notes: input.notes ?? null,
			sortOrder: input.sortOrder ?? 0
		})
		.returning();
	return row;
}

export async function removeParticipant(id: string): Promise<void> {
	await db.delete(sessionParticipants).where(eq(sessionParticipants.id, id));
}
```

- [ ] **Step 7: Export new functions from the module**

Ensure `addParticipant`, `removeParticipant`, `listParticipantsForSession` are exported (they will be since they're top-level `export async function`).

- [ ] **Step 8: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

Expected: errors in the route files that reference old `clientName`/`clientNames` fields — fix these in Tasks 6–7.

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/sessions/queries.ts
git commit -m "feat(spec-4): session queries — attachParticipants, participantNames replaces clientNames, participant CRUD"
```

---

### Task 6: Booking create form — remove instructor for session services

**Files:**
- Modify: `src/routes/(app)/bookings/new/+page.server.ts`
- Modify: `src/routes/(app)/bookings/new/+page.svelte`

- [ ] **Step 1: Update server action**

In `src/routes/(app)/bookings/new/+page.server.ts`, find the `hasSessions` block (around line 118). Remove `instructorId` from the `createBooking` call in that block:

```ts
// For hasSessions services: read sessionsIncluded, ignore multi-day form fields
if (service.hasSessions) {
	const sessionsIncludedRaw = form.get('sessionsIncluded')?.toString();
	const sessionsIncluded = sessionsIncludedRaw ? Math.max(1, parseInt(sessionsIncludedRaw)) : 1;

	const booking = await createBooking({
		serviceId, date, isFlexible, status, spotNotes, notes,
		sessionsIncluded,
		clients: bookingClients
		// NO instructorId — instructor assigned per session
	});
	// ... rest of session creation unchanged
```

Keep `instructorId` in the non-sessions path (rentals, products) — it stays for those.

- [ ] **Step 2: Update the Svelte form**

In `src/routes/(app)/bookings/new/+page.svelte`, find the instructor dropdown section. It's currently shown when `showInstructor` is true. Change the derived:

```ts
// OLD:
const showInstructor = $derived(isLesson);
// NEW:
const showInstructor = $derived(!isLesson && !isCamp && !isAccommodation && selectedService?.requiresInstructor);
```

This hides the instructor field for session-based services (lessons) and shows it only for non-session services that require one.

- [ ] **Step 3: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/bookings/new/
git commit -m "feat(spec-4): booking create — no instructor for session-based services"
```

---

### Task 7: Booking detail — participants UI, hide booking-level instructor for sessions

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 1: Add participant actions to server**

In `src/routes/(app)/bookings/[id]/+page.server.ts`, add import:

```ts
import {
	// existing imports...
	addParticipant,
	removeParticipant
} from '$lib/features/sessions/queries';
```

Add two new actions at the end of the `actions` object:

```ts
addParticipant: async ({ request }) => {
	const form = await request.formData();
	const sessionId = form.get('sessionId')?.toString() ?? '';
	const name = form.get('participantName')?.toString().trim() ?? '';
	if (!sessionId || !name) return fail(400, { error: 'Session and name are required' });
	await addParticipant({ sessionId, name });
	return { error: null, message: 'Participant added' };
},

removeParticipant: async ({ request }) => {
	const form = await request.formData();
	const participantId = form.get('participantId')?.toString() ?? '';
	if (!participantId) return fail(400, { error: 'Missing participant id' });
	await removeParticipant(participantId);
	return { error: null, message: 'Participant removed' };
},
```

- [ ] **Step 2: Fix reference to removed `booking.instructorId` in page.server.ts**

In the `update` action, remove `instructorId` from the `updateBooking` call for session-based bookings. Add a check:

```ts
update: async ({ request, params }) => {
	const form = await request.formData();
	const newStatus = form.get('status')?.toString() as BookingStatus;
	const booking = await getBooking(params.id);
	if (!booking) return fail(404, { error: 'Not found' });

	const isSessionBased = booking.serviceHasSessions;
	await updateBooking(params.id, {
		// Only pass instructorId for non-session bookings
		...(isSessionBased ? {} : { instructorId: form.get('instructorId')?.toString() || null }),
		date: form.get('date')?.toString(),
		time: isSessionBased ? undefined : (form.get('time')?.toString() || null),
		isFlexible: form.get('isFlexible') === 'true',
		status: newStatus,
		spotNotes: form.get('spotNotes')?.toString() || null,
		notes: form.get('notes')?.toString() || null
	});
	const message = newStatus === 'confirmed' ? 'Booking confirmed' : 'Booking updated';
	return { error: null, message };
},
```

- [ ] **Step 3: Update Svelte — hide booking-level instructor for session services, add participant UI**

In `src/routes/(app)/bookings/[id]/+page.svelte`:

**A) Hide instructor field at booking level for hasSessions services:**

Find the instructor display/edit section in the booking details panel. Wrap it in:
```svelte
{#if !data.booking.serviceHasSessions}
  <!-- instructor field here -->
{/if}
```

Similarly, hide the `time` field at booking level for session services:
```svelte
{#if !data.booking.serviceHasSessions}
  <!-- time field here -->
{/if}
```

**B) Add participants section inside each session card:**

Inside the session list, after the instructor section of each session card, add:

```svelte
<!-- Participants -->
<div class="mt-2 border-t border-border/50 pt-2">
  <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
    Who's attending
  </p>
  {#if s.participants.length > 0}
    <div class="flex flex-wrap gap-1.5">
      {#each s.participants as p}
        <div class="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 ring-1 ring-border">
          <span class="text-xs text-gray-700">{p.name}</span>
          <form method="post" action="?/removeParticipant" use:enhance={withToast()}>
            <input type="hidden" name="participantId" value={p.id} />
            <button type="submit" class="ml-0.5 text-muted hover:text-red-500 leading-none">×</button>
          </form>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-xs text-muted italic">No participants set — defaults to booking client</p>
  {/if}
  <!-- Add participant inline form -->
  <form method="post" action="?/addParticipant" use:enhance={withToast()}
        class="mt-2 flex gap-2">
    <input type="hidden" name="sessionId" value={s.id} />
    <input name="participantName" placeholder="Add name…"
           class="input input-sm flex-1 text-xs" />
    <button type="submit" class="btn btn-sm btn-ghost text-xs">+ Add</button>
  </form>
</div>
```

Note: `s.participants` is now on the `Session` type. Ensure `data.sessions` is typed as `Session[]` (already the case from `listSessionsForBooking`).

- [ ] **Step 4: Fix any remaining `clientName` / `clientPhone` references in the booking detail**

Search for `clientName` and `clientPhone` usage in the booking detail page that referenced old `AgendaSession` fields. These don't apply here (this page uses `Session[]` not `AgendaSession`), but check for any stale references.

- [ ] **Step 5: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/\(app\)/bookings/\[id\]/
git commit -m "feat(spec-4): booking detail — participant add/remove per session, hide instructor for session services"
```

---

### Task 8: Fix Today/Agenda page — sessions only

**Files:**
- Modify: `src/routes/(app)/agenda/+page.server.ts`
- Modify: `src/routes/(app)/agenda/+page.svelte`

The Agenda page becomes "Today" — operational session briefing. No booking-level cards. Uses the renamed `participantNames` field.

- [ ] **Step 1: Update server**

Replace `src/routes/(app)/agenda/+page.server.ts`:

```ts
import { eq, ne, sum, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingClients, bookings } from '$lib/server/db/schema';
import { listSessionsForDateRange } from '$lib/features/sessions/queries';
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

export const load: PageServerLoad = async () => {
	const today = getTodayString();

	const past = new Date();
	past.setDate(past.getDate() - 30);
	const future = new Date();
	future.setDate(future.getDate() + 90);

	const from = formatDate(past);
	const to = formatDate(future);

	const [sessions, bookingsInRange, events, stats] = await Promise.all([
		listSessionsForDateRange(from, to),
		listBookingsForDateRange(from, to),
		listEventsForDateRange(today, to),
		loadStats(today)
	]);

	// Active camps: roster + date range + not cancelled + end date in future
	const activeCamps = bookingsInRange.filter(
		b => b.serviceHasRoster && b.dateEnd && b.status !== 'cancelled' && b.dateEnd >= today
	);
	const campIds = new Set(activeCamps.map(c => c.id));

	const todaySessions = sessions.filter(s => s.date === today);
	const scheduledToday = todaySessions.filter(s => s.status === 'scheduled').length;
	const unscheduledTotal = sessions.filter(s => s.status === 'unscheduled' && s.date >= today).length;

	return {
		sessions, activeCamps, events, today,
		stats: { scheduledToday, unscheduledTotal, pendingRevenue: stats.pendingRevenue }
	};
};
```

- [ ] **Step 2: Update Svelte — rename to "Today", use participantNames**

In `src/routes/(app)/agenda/+page.svelte`:

Replace the page title from `Agenda` to `Today`:
```svelte
<h1 class="page-title">Today</h1>
```

Replace all references to `s.clientName` with `s.participantNames.length > 0 ? s.participantNames.join(', ') : null`.

Replace `s.clientPhone` references — remove (phone no longer on session, it's at client/booking level).

In the session card subtitle:
```svelte
<p class="mt-0.5 text-xs text-muted">
  {#if s.serviceHasRoster}
    {s.enrolledCount}{s.maxCapacity != null ? `/${s.maxCapacity}` : ''} enrolled
  {:else if s.participantNames.length > 0}
    {s.participantNames.join(' · ')}
  {/if}
  {#if s.instructors.length > 0}
    · 🌊 {s.instructors.map(i => i.instructorName).filter(Boolean).join(', ')}
  {/if}
  {#if s.notes}· {s.notes}{/if}
</p>
```

Similarly update the unscheduled session links to use `participantNames`:
```svelte
<span>{fmtDate(s.date)} · {s.serviceName ?? 'Session'}
  {#if s.participantNames.length > 0} · {s.participantNames[0]}{/if}
</span>
```

- [ ] **Step 3: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/agenda/
git commit -m "feat(spec-4+5): Today page (was Agenda) — sessions only, participantNames, no booking cards"
```

---

## Phase 2 — Navigation & Views

---

### Task 9: Calendar — session-only dots for month/week views

**Files:**
- Modify: `src/routes/(app)/calendar/+page.server.ts`
- Modify: `src/routes/(app)/calendar/+page.svelte`

The calendar month and week views should show session count dots (not booking rectangles). Day view is already session-focused — leave it.

- [ ] **Step 1: Update server to fetch sessions for month/week**

In `src/routes/(app)/calendar/+page.server.ts`, update to fetch sessions for non-day views:

```ts
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { listSessionsForDate, listSessionsForDateRange } from '$lib/features/sessions/queries';
// ... other imports

export const load: PageServerLoad = async ({ url }) => {
	// ... existing view/date param parsing ...

	const [bookings, events, daySessions, rangedSessions, instructors] = await Promise.all([
		// Bookings still needed for week view spanning bars (accommodation, rentals)
		// and for month view event dots
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to),
		view === 'day' ? listSessionsForDate(dayDate) : Promise.resolve([]),
		// Sessions for month/week dot display
		view !== 'day' ? listSessionsForDateRange(from, to) : Promise.resolve([]),
		view === 'day' ? listInstructors() : Promise.resolve([])
	]);

	// ... rest of helpers unchanged ...

	return {
		bookings, events, daySessions, rangedSessions, instructors, view, year, month,
		weekStart, weekDays, prevWeek, nextWeek,
		dayDate, prevDay, nextDay, dayLabel,
		today: todayStr
	};
};
```

- [ ] **Step 2: Update Svelte — month view dots = session counts**

In `src/routes/(app)/calendar/+page.svelte`:

For the month view grid, replace the current booking-based dots with session-based dots. Find the month grid cell rendering and update:

```svelte
{@const daySessionCount = data.rangedSessions.filter(s => s.date === day).length}
<!-- Show dot if there are sessions -->
{#if daySessionCount > 0}
  <span class="mt-0.5 flex items-center gap-0.5">
    <span class="inline-block h-1.5 w-1.5 rounded-full bg-ocean"></span>
    {#if daySessionCount > 1}
      <span class="text-[9px] text-muted">{daySessionCount}</span>
    {/if}
  </span>
{/if}
```

For the week view, replace booking blocks with session blocks. Each session in `rangedSessions` that falls on a week day gets a small colored chip showing service name and time.

- [ ] **Step 3: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/calendar/
git commit -m "feat(spec-5): calendar month/week — session-count dots replace booking bars"
```

---

### Task 10: Bookings list page

**Files:**
- Create: `src/routes/(app)/bookings/+page.server.ts`
- Create: `src/routes/(app)/bookings/+page.svelte`

- [ ] **Step 1: Create server load**

Create `src/routes/(app)/bookings/+page.server.ts`:

```ts
import { listAllBookings } from '$lib/features/bookings/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const bookings = await listAllBookings();
	return { bookings };
};
```

- [ ] **Step 2: Create list UI**

Create `src/routes/(app)/bookings/+page.svelte`:

```svelte
<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let statusFilter = $state<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
	let search = $state('');

	const filtered = $derived(
		data.bookings.filter(b => {
			if (statusFilter !== 'all' && b.status !== statusFilter) return false;
			if (search.length > 1) {
				const q = search.toLowerCase();
				const name = (b.firstClientName ?? '').toLowerCase();
				const svc = (b.serviceName ?? '').toLowerCase();
				if (!name.includes(q) && !svc.includes(q)) return false;
			}
			return true;
		})
	);

	function fmtDate(d: string) {
		return new Date(d + 'T00:00:00').toLocaleDateString('default', {
			day: 'numeric', month: 'short', year: 'numeric'
		});
	}

	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending: 'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="page-header">
		<h1 class="page-title">Bookings</h1>
		<a href="/bookings/new" class="btn btn-primary btn-sm">+ New</a>
	</div>

	<!-- Filters -->
	<div class="flex items-center gap-2 border-b border-border px-4 py-2.5">
		<input
			bind:value={search}
			placeholder="Search client or service…"
			class="input input-sm flex-1 text-sm"
		/>
		<div class="flex gap-1">
			{#each (['all', 'pending', 'confirmed', 'cancelled'] as const) as s}
				<button
					onclick={() => statusFilter = s}
					class="rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors
					       {statusFilter === s ? 'bg-ocean text-white' : 'bg-surface text-muted ring-1 ring-border hover:text-gray-700'}"
				>
					{s}
				</button>
			{/each}
		</div>
	</div>

	<!-- List -->
	<div class="flex-1 overflow-y-auto">
		{#if filtered.length === 0}
			<p class="py-16 text-center text-sm text-muted">No bookings found.</p>
		{:else}
			<div class="divide-y divide-border">
				{#each filtered as b}
					{@const c = getServiceColor(b.serviceColor ?? '')}
					<a
						href="/bookings/{b.id}"
						class="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
					>
						<!-- Color bar -->
						<div class="h-9 w-1 shrink-0 rounded-full {c.bg}"></div>

						<!-- Main info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<p class="truncate text-sm font-semibold text-gray-900">
									{b.firstClientName ?? '—'}
								</p>
								<p class="truncate text-xs text-muted">{b.serviceName ?? 'Unknown service'}</p>
							</div>
							<div class="mt-0.5 flex items-center gap-2 text-xs text-muted">
								<span>{fmtDate(b.date)}</span>
								{#if b.serviceHasSessions}
									<span>·</span>
									<span class="{b.scheduledCount < (b.sessionCount) ? 'text-amber-600' : 'text-green-600'}">
										{b.scheduledCount}/{b.sessionCount} sessions
									</span>
								{/if}
							</div>
						</div>

						<!-- Status + payment -->
						<div class="flex shrink-0 flex-col items-end gap-1">
							<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {statusColors[b.status] ?? ''}">
								{b.status}
							</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
```

- [ ] **Step 3: Type check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/bookings/+page.server.ts src/routes/\(app\)/bookings/+page.svelte
git commit -m "feat(spec-5): /bookings list page — filter by status, search, session progress"
```

---

### Task 11: Navigation — add Bookings, rename Agenda→Today

**Files:**
- Modify: `src/lib/components/nav/BottomNav.svelte`
- Modify: `src/lib/components/nav/Sidebar.svelte`

- [ ] **Step 1: Update BottomNav**

Replace the full content of `src/lib/components/nav/BottomNav.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, BookOpen, Users, LayoutGrid, Sun } from 'lucide-svelte';

	const items = [
		{ href: '/today',     label: 'Today',     icon: Sun        },
		{ href: '/calendar',  label: 'Calendar',  icon: Calendar   },
		{ href: '/bookings',  label: 'Bookings',  icon: BookOpen   },
		{ href: '/clients',   label: 'Clients',   icon: Users      },
		{ href: '/services',  label: 'Services',  icon: LayoutGrid }
	];
</script>

<nav
	aria-label="Main navigation"
	class="fixed right-0 bottom-0 left-0 z-50 flex justify-around border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	{#each items as item}
		{@const active = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
		<a
			href={item.href}
			aria-current={active ? 'page' : undefined}
			aria-label={item.label}
			class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
			       transition-colors duration-150
			       {active ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
		>
			<span class="relative flex h-6 w-6 items-center justify-center">
				{#if active}
					<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>
				{/if}
				<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
			</span>
			<span class="truncate">{item.label}</span>
		</a>
	{/each}
</nav>
```

Note: The `/agenda` route now renders the Today page content — no route rename needed in the filesystem (to avoid breaking bookmarks), just the nav label and URL changes. Actually for cleanliness, create a redirect: add `src/routes/(app)/today/` that redirects to `/agenda`, OR rename the route. Decision: rename the route directory from `agenda` to `today` and add a redirect from `/agenda` → `/today`.

- [ ] **Step 2: Create Today route redirect**

Create `src/routes/(app)/today/+page.server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async () => {
	// Today content lives at /agenda (legacy name) — serve it from there
};
```

Actually, simpler: move `agenda/` → `today/` directory rename, then add `src/routes/(app)/agenda/+page.server.ts` redirect stub:

```bash
# In terminal:
mv src/routes/\(app\)/agenda src/routes/\(app\)/today
```

Then create redirect stub `src/routes/(app)/agenda/+page.server.ts`:
```ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async () => {
	redirect(301, '/today');
};
```

And `src/routes/(app)/agenda/+page.svelte` (minimal, never rendered):
```svelte
<!-- redirects to /today via server load -->
```

- [ ] **Step 3: Update Sidebar**

Replace the `items` array in `src/lib/components/nav/Sidebar.svelte`:

```ts
import { Calendar, BookOpen, Users, UserCheck, LayoutGrid, Settings, Waves, Sun } from 'lucide-svelte';

const items = [
	{ href: '/today',       label: 'Today',     icon: Sun        },
	{ href: '/calendar',    label: 'Calendar',  icon: Calendar   },
	{ href: '/bookings',    label: 'Bookings',  icon: BookOpen   },
	{ href: '/clients',     label: 'Clients',   icon: Users      },
	{ href: '/instructors', label: 'Staff',     icon: UserCheck  },
	{ href: '/services',    label: 'Services',  icon: LayoutGrid }
];
```

Also update the active check to handle `/bookings` not matching `/bookings/new` as a different tab:
```ts
// In template:
{@const active = item.href === '/bookings'
  ? page.url.pathname === '/bookings' || page.url.pathname.startsWith('/bookings/')
  : page.url.pathname.startsWith(item.href)}
```

- [ ] **Step 4: Type check + full build check**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

- [ ] **Step 5: Final commit**

```bash
git add src/lib/components/nav/ src/routes/\(app\)/today/ src/routes/\(app\)/agenda/
git commit -m "feat(spec-5): nav — Today replaces Agenda, Bookings tab added, route /agenda → /today redirect"
```

---

### Task 12: Final integration check

- [ ] **Step 1: Full type check — zero errors expected**

```bash
CLAUDE_CODE_TMPDIR=/tmp npm run check 2>&1 | grep ERROR | grep -v "auth-seed\|reset-auth"
```

Expected output: `0 errors` (only the pre-existing auth-seed/reset-auth errors from unrelated utility files).

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: successful build, no errors.

- [ ] **Step 3: Squash commit with spec tag**

```bash
git log --oneline | head -20
# Review commits from this spec
git commit --allow-empty -m "chore: spec-4 + spec-5 complete — data model clean + nav restructure"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| Remove `bookings.instructor_id` | Tasks 1, 2, 4 |
| Migrate data to `booking_instructors` | Task 1 |
| `session_participants` table | Tasks 1, 2, 5 |
| Participant CRUD queries | Task 5 |
| Type updates (BookingListItem, SessionParticipant, participantNames) | Task 3 |
| Booking create — no instructor for session services | Task 6 |
| Booking detail — participant add/remove UI | Task 7 |
| `listAllBookings` with sessionCount | Task 4 |
| `/bookings` list page | Task 10 |
| Today page (session-only, renamed from Agenda) | Task 8 |
| Calendar month/week session dots | Task 9 |
| Nav: Bookings tab, Agenda→Today | Task 11 |

All requirements covered. No gaps found.

**Type consistency check:**
- `SessionParticipant` defined in Task 3, used in Task 5 ✓
- `participantNames: string[]` defined in Task 3 types, produced in Task 5 queries, consumed in Tasks 8/9 views ✓
- `BookingListItem` defined in Task 3, produced in Task 4 `listAllBookings`, consumed in Task 10 ✓
- `Session.participants` added in Task 3, populated in Task 5 `attachParticipants` ✓
- `addParticipant`/`removeParticipant` defined in Task 5, imported in Task 7 ✓

**No placeholders detected.** All steps contain actual code.
