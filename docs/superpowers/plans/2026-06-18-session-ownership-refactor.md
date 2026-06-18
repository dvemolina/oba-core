# Session Ownership Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate session ownership from booking-scoped junction table (`booking_sessions`) to explicit `owner_type` enum + direct FKs on `sessions`, eliminating the junction table and adding `bookings.session_id` for group class enrollment.

**Architecture:** Sessions get `owner_type` ∈ {`booking`, `service`, `edition`} plus three nullable FK columns enforced by a DB check constraint. Group class enrollment uses `bookings.session_id` (nullable FK, ON DELETE SET NULL) — the industry-standard model. `booking_sessions` is kept alive through Phase 2 then dropped in a later cleanup migration (Phase 3, out of scope here).

**Tech Stack:** Drizzle ORM 0.45, PostgreSQL, SvelteKit, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-17-session-ownership-refactor-design.md`

---

## File Map

| File | Change |
| --- | --- |
| `src/lib/server/db/schema.ts` | Add enum, new session cols, `bookings.session_id`, fix participant index, drop `bookingIdTemp` |
| `drizzle/0039_session_ownership.sql` | Phase 1 migration: additive cols + smart backfill + constraints |
| `src/lib/features/sessions/types.ts` | Full replacement — `SessionOwnerType`, discriminated union types, type guards |
| `src/lib/features/sessions/queries.ts` | Major rewrite — dispatch, per-owner queries, enrollment, calendar enrichment, sync, routing helper |
| `src/lib/features/bookings/types.ts` | Add `sessionId: string \| null` to `Booking` |
| `src/lib/features/bookings/queries.ts` | `recalcBookingAmounts` edition-aware, add `recalcEditionBookingAmounts` |
| `src/routes/(app)/bookings/[id]/+page.server.ts` | `listSessionsForContext`, action guards, assign/unassign actions |
| `src/routes/(app)/bookings/[id]/+page.svelte` | Pass `sessionOwnerType` to `BookingDetailCard` |
| `src/lib/modules/sessions/BookingDetailCard.svelte` | Three-mode rendering: full CRUD / assign+view / read-only |
| `src/routes/(app)/services/[id]/sessions/+page.server.ts` | **NEW** — group class session management |
| `src/routes/(app)/services/[id]/sessions/+page.svelte` | **NEW** — group class sessions UI |
| `src/routes/(app)/services/[id]/roster/+page.server.ts` | Add edition session load + actions |
| `src/routes/(app)/services/[id]/roster/+page.svelte` | Add sessions section per edition tab |
| `src/routes/(app)/services/[id]/+page.server.ts` | Load `hasSessions` flag |
| `src/routes/(app)/services/[id]/+page.svelte` | Sessions nav link for group-class services |
| `src/routes/(app)/calendar/+page.server.ts` | Import `listSessionsForDate`/`listSessionsForDateRange` (same names, rewritten) |
| `src/routes/(app)/calendar/+page.svelte` | Use `sessionDetailLink` for card routing; `primaryBookingId` instead of `bookingId` |
| `src/routes/(app)/agenda/+page.server.ts` | Same imports (rewritten internals) |
| `src/routes/(app)/agenda/+page.svelte` | Use `primaryBookingId`, `sessionDetailLink` |

---

## Task 1: Schema — `src/lib/server/db/schema.ts`

**Files:**
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Add `sessionOwnerTypeEnum` before the `sessions` table definition**

Find the block that starts `export const sessionStatusEnum`:

```ts
export const sessionStatusEnum = pgEnum('session_status', ['unscheduled', 'scheduled', 'cancelled']);
```

Add the new enum immediately after it:

```ts
export const sessionOwnerTypeEnum = pgEnum('session_owner_type', ['booking', 'service', 'edition']);
```

- [ ] **Step 2: Replace the `sessions` table definition**

Replace the entire `sessions` table (lines ~217–233) with:

```ts
export const sessions = pgTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	ownerType: sessionOwnerTypeEnum('owner_type').notNull(),
	bookingId: text('booking_id')
		.references(() => bookings.id, { onDelete: 'cascade' }),
	serviceId: text('service_id')
		.references(() => services.id, { onDelete: 'cascade' }),
	serviceEditionId: text('service_edition_id')
		.references(() => serviceEditions.id, { onDelete: 'cascade' }),
	date: date('date').notNull(),
	time: time('time'),
	durationMinutes: integer('duration_minutes'),
	notes: text('notes'),
	skillLevel: skillLevelEnum('skill_level'),
	status: sessionStatusEnum('status').notNull().default('unscheduled'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => [
	index('idx_sessions_date').on(t.date),
	index('idx_sessions_status').on(t.status),
	index('idx_sessions_booking_id').on(t.bookingId),
	index('idx_sessions_service_id').on(t.serviceId),
	index('idx_sessions_service_edition_id').on(t.serviceEditionId)
]);
```

- [ ] **Step 3: Add `sessionId` to `bookings` table**

In the `bookings` table definition, add after `notes`:

```ts
sessionId: text('session_id')
	.references((): AnyPgColumn => sessions.id, { onDelete: 'set null' }),
```

In the `bookings` table indexes array, add:

```ts
index('idx_bookings_session_id').on(t.sessionId)
```

- [ ] **Step 4: Fix `sessionParticipants` unique constraint**

Replace:

```ts
uniqueIndex('uq_session_participants_session_name').on(t.sessionId, t.name)
```

with (regular index — partial unique index enforced via migration SQL):

```ts
index('idx_session_participants_bp').on(t.sessionId, t.bookingParticipantId)
```

- [ ] **Step 5: Remove `bookingIdTemp` from `bookingParticipants`**

Delete this line from the `bookingParticipants` table:

```ts
bookingIdTemp: text('booking_id_temp'),  // kept temporarily for migration script
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to schema changes. (There will be errors from old query code — those are fixed in later tasks.)

---

## Task 2: Migration SQL — `drizzle/0039_session_ownership.sql`

**Files:**
- Create: `drizzle/0039_session_ownership.sql`

- [ ] **Step 1: Write the migration file**

Create `drizzle/0039_session_ownership.sql` with the full Phase 1 migration:

```sql
BEGIN;

-- 1. Enum
CREATE TYPE session_owner_type AS ENUM ('booking', 'service', 'edition');

-- 2. Add nullable columns to sessions
ALTER TABLE sessions
  ADD COLUMN owner_type         session_owner_type,
  ADD COLUMN booking_id         text REFERENCES bookings(id) ON DELETE CASCADE,
  ADD COLUMN service_id         text REFERENCES services(id) ON DELETE CASCADE,
  ADD COLUMN service_edition_id text REFERENCES service_editions(id) ON DELETE CASCADE;

-- 3. Add session_id to bookings (group class enrollment)
ALTER TABLE bookings ADD COLUMN session_id text REFERENCES sessions(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX idx_sessions_booking_id          ON sessions(booking_id);
CREATE INDEX idx_sessions_service_id          ON sessions(service_id);
CREATE INDEX idx_sessions_service_edition_id  ON sessions(service_edition_id);
CREATE INDEX idx_bookings_session_id          ON bookings(session_id);

-- 5. Detect + delete orphaned sessions (no booking_sessions link)
DO $$
DECLARE orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM sessions s
  WHERE NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.session_id = s.id);
  RAISE NOTICE '[migration] Orphaned sessions to delete: %', orphan_count;
END $$;

DELETE FROM sessions
WHERE NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.session_id = sessions.id);

-- 6. Smart backfill: classify each session by its booking's service modules
UPDATE sessions s
SET
  owner_type = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions')
      THEN 'edition'::session_owner_type
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions') AND b.service_id IS NOT NULL
      THEN 'service'::session_owner_type
    ELSE 'booking'::session_owner_type
  END,
  booking_id = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions') THEN NULL
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions')     THEN NULL
    ELSE primary_link.booking_id
  END,
  service_id = CASE
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions') THEN b.service_id
    ELSE NULL
  END,
  service_edition_id = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions') THEN b.service_edition_id
    ELSE NULL
  END
FROM (
  SELECT DISTINCT ON (session_id) session_id, booking_id
  FROM booking_sessions ORDER BY session_id, created_at ASC
) AS primary_link
JOIN bookings b ON b.id = primary_link.booking_id
LEFT JOIN services svc ON svc.id = b.service_id
WHERE s.id = primary_link.session_id;

-- 7. Backfill bookings.session_id for group class bookings
UPDATE bookings b
SET session_id = bs.session_id
FROM booking_sessions bs
JOIN sessions s ON s.id = bs.session_id
WHERE bs.booking_id = b.id
  AND s.owner_type = 'service';

-- 8. Abort if any session unclassified
DO $$
DECLARE unclassified integer;
BEGIN
  SELECT COUNT(*) INTO unclassified FROM sessions WHERE owner_type IS NULL;
  IF unclassified > 0 THEN
    RAISE EXCEPTION '[migration] % unclassified sessions — aborting', unclassified;
  END IF;
END $$;

-- 9. Enforce NOT NULL + check constraint
ALTER TABLE sessions ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE sessions ADD CONSTRAINT chk_session_owner CHECK (
  (owner_type = 'booking'  AND booking_id IS NOT NULL          AND service_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'service'  AND service_id IS NOT NULL          AND booking_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'edition'  AND service_edition_id IS NOT NULL  AND booking_id IS NULL AND service_id IS NULL)
);

-- 10. Fix session_participants unique constraint
DROP INDEX IF EXISTS uq_session_participants_session_name;
CREATE UNIQUE INDEX uq_session_participants_bp
  ON session_participants(session_id, booking_participant_id)
  WHERE booking_participant_id IS NOT NULL;

-- 11. Drop leftover column
ALTER TABLE booking_participants DROP COLUMN IF EXISTS booking_id_temp;

COMMIT;
```

- [ ] **Step 2: Apply the migration**

```bash
npm run db:migrate
```

Expected: "Migration applied successfully" (or similar). No errors.

---

## Task 3: Post-migration verification

- [ ] **Step 1: Run verification queries via db:studio or psql**

```sql
-- All sessions classified
SELECT COUNT(*) FROM sessions WHERE owner_type IS NULL;                                    -- must be 0

-- Distribution across owner types
SELECT owner_type, COUNT(*) FROM sessions GROUP BY owner_type;                             -- shows all 3

-- No service/edition sessions with booking_id set
SELECT COUNT(*) FROM sessions
  WHERE owner_type IN ('service','edition') AND booking_id IS NOT NULL;                    -- must be 0

-- Group class assignments backfilled
SELECT COUNT(*) FROM bookings WHERE session_id IS NOT NULL;                                -- >= 0

-- Partial unique index present
SELECT indexname FROM pg_indexes
  WHERE tablename = 'session_participants' AND indexname = 'uq_session_participants_bp';   -- 1 row

-- booking_id_temp gone
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'booking_participants' AND column_name = 'booking_id_temp';           -- 0 rows
```

---

## Task 4: Replace `src/lib/features/sessions/types.ts`

**Files:**
- Modify: `src/lib/features/sessions/types.ts`

- [ ] **Step 1: Full replacement**

Replace the entire file with:

```ts
import type { ServiceModules } from '$lib/features/services/modules';

export type SessionStatus    = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';
export type SkillLevel       = 'beginner' | 'intermediate' | 'advanced';
export type SessionOwnerType = 'booking' | 'service' | 'edition';

export type SessionContext =
	| { type: 'booking'; bookingId: string }
	| { type: 'service'; serviceId: string; date: string }
	| { type: 'edition'; editionId: string }

// Minimal shape needed by resolveSessionContext — full Booking satisfies this structurally
export interface BookingSessionContext {
	id: string;
	date: string;
	serviceId: string | null;
	serviceEditionId: string | null;
	serviceModules: ServiceModules | null;
}

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
	bookingParticipantId: string | null;
	notes: string | null;
	sortOrder: number;
}

export interface Session {
	id: string;
	ownerType: SessionOwnerType;
	bookingId: string | null;         // set when ownerType='booking'
	serviceId: string | null;         // set when ownerType='service'
	serviceEditionId: string | null;  // set when ownerType='edition'
	date: string;
	time: string | null;
	durationMinutes: number | null;
	notes: string | null;
	skillLevel: SkillLevel | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	participants: SessionParticipant[];
	createdAt: Date;
	updatedAt: Date;
}

// Calendar day view — enriched with booking/service context
export interface SessionForDay extends Session {
	primaryBookingId: string | null;  // null for edition sessions
	bookingIds: string[];
	editionId: string | null;
	bookingStatus: string | null;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	participantNames: string[];
	totalParticipants: number;
	totalAmountDue: number;
	totalAmountPaid: number;
}

// Agenda view — enriched with full booking/client context
export interface AgendaSession extends Session {
	primaryBookingId: string | null;
	bookingIds: string[];
	editionId: string | null;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasRoster: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	sessionsIncluded: number | null;
	bookingStatus: string | null;
	bookingDate: string;
	bookingDateEnd: string | null;
	isFlexible: boolean;
	firstClientName: string | null;
	participantNames: string[];
	totalParticipants: number;
	enrolledCount: number;
	maxCapacity: number | null;
	totalAmountDue: number;
	totalAmountPaid: number;
}

// Discriminated union — ownerType drives which FK is set
export type CreateSessionInput =
	| ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
	| ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
	| ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)

export interface BaseSessionInput {
	date: string;
	time?: string;
	durationMinutes?: number;
	notes?: string;
	skillLevel?: SkillLevel;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	durationMinutes?: number | null;
	notes?: string | null;
	skillLevel?: SkillLevel | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface CreateParticipantInput {
	sessionId: string;
	name: string;
	bookingParticipantId?: string;
	notes?: string;
	sortOrder?: number;
}

export interface BulkGenOptions {
	sessionsPerDay: number;
	times: (string | undefined)[];
	weekdaysOnly: boolean;
	durationMinutes?: number;
	clearExisting: boolean;
}

// Type guards
export const isBookingSession  = (s: Session): s is Session & { bookingId: string }        => s.ownerType === 'booking';
export const isServiceSession  = (s: Session): s is Session & { serviceId: string }        => s.ownerType === 'service';
export const isEditionSession  = (s: Session): s is Session & { serviceEditionId: string } => s.ownerType === 'edition';

export interface BookingEnrollment {
	bookingId: string;
	clientId: string;
	firstName: string | null;
	lastName: string | null;
	amountDue: string;
	amountPaid: string;
	status: 'enrolled' | 'cancelled';
}
```

- [ ] **Step 2: Verify no TS errors in types file**

```bash
npx tsc --noEmit 2>&1 | grep "sessions/types"
```

Expected: no output (no errors in this file).

---

## Task 5: Rewrite `src/lib/features/sessions/queries.ts`

This is the core of the refactor. Replace the entire file. Steps 1–7 cover each section.

**Files:**
- Modify: `src/lib/features/sessions/queries.ts`

- [ ] **Step 1: Write file header, imports, SESSION_COLS constant**

```ts
import { and, count, eq, gte, inArray, isNull, lte, ne, sql, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sessions,
	sessionInstructors,
	sessionParticipants,
	bookings,
	bookingClients,
	bookingParticipants,
	clients,
	services,
	serviceEditions
} from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import type {
	AgendaSession,
	BaseSessionInput,
	BookingEnrollment,
	BookingSessionContext,
	BulkGenOptions,
	CreateParticipantInput,
	CreateSessionInput,
	Session,
	SessionContext,
	SessionForDay,
	SessionInstructor,
	SessionOwnerType,
	SessionParticipant,
	UpdateSessionInput
} from './types';

// Shared column selector — one edit point when schema changes
const SESSION_COLS = {
	id: sessions.id,
	ownerType: sessions.ownerType,
	bookingId: sessions.bookingId,
	serviceId: sessions.serviceId,
	serviceEditionId: sessions.serviceEditionId,
	date: sessions.date,
	time: sessions.time,
	durationMinutes: sessions.durationMinutes,
	notes: sessions.notes,
	skillLevel: sessions.skillLevel,
	status: sessions.status,
	sortOrder: sessions.sortOrder,
	createdAt: sessions.createdAt,
	updatedAt: sessions.updatedAt
} as const;
```

- [ ] **Step 2: Write attachment helpers (unchanged from old code, just update types)**

```ts
async function attachInstructors<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { instructors: SessionInstructor[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, instructors: [] }));
	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionInstructors.id,
			sessionId: sessionInstructors.sessionId,
			instructorId: sessionInstructors.instructorId,
			instructorName: userTable.name
		})
		.from(sessionInstructors)
		.leftJoin(userTable, eq(sessionInstructors.instructorId, userTable.id))
		.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);

	const bySession: Record<string, typeof rows> = {};
	for (const row of rows) (bySession[row.sessionId] ??= []).push(row);

	return sessionRows.map(s => ({
		...s,
		instructors: (bySession[s.id] ?? []).map(r => ({
			id: r.id, sessionId: r.sessionId,
			instructorId: r.instructorId, instructorName: r.instructorName
		}))
	}));
}

async function attachParticipants<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { participants: SessionParticipant[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, participants: [] }));
	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionParticipants.id,
			sessionId: sessionParticipants.sessionId,
			bookingParticipantId: sessionParticipants.bookingParticipantId,
			name: sessionParticipants.name,
			notes: sessionParticipants.notes,
			sortOrder: sessionParticipants.sortOrder
		})
		.from(sessionParticipants)
		.where(sql`${sessionParticipants.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`)
		.orderBy(sessionParticipants.sortOrder);

	const bySession: Record<string, SessionParticipant[]> = {};
	for (const r of rows) (bySession[r.sessionId] ??= []).push(r);
	return sessionRows.map(s => ({ ...s, participants: bySession[s.id] ?? [] }));
}
```

- [ ] **Step 3: Write dispatch functions + per-owner list queries**

```ts
// ── Dispatch (single inspection point for service modules) ────────────────────

export function resolveSessionContext(booking: BookingSessionContext): SessionContext {
	const m = booking.serviceModules ?? {};
	if ('editions' in m && booking.serviceEditionId)
		return { type: 'edition', editionId: booking.serviceEditionId };
	if ('roster' in m && booking.serviceId)
		return { type: 'service', serviceId: booking.serviceId, date: booking.date };
	return { type: 'booking', bookingId: booking.id };
}

export async function listSessionsForContext(booking: BookingSessionContext): Promise<Session[]> {
	const ctx = resolveSessionContext(booking);
	switch (ctx.type) {
		case 'booking':  return listSessionsForBooking(ctx.bookingId);
		case 'service':  return listSessionsForServiceOnDate(ctx.serviceId, ctx.date);
		case 'edition':  return listSessionsForEdition(ctx.editionId);
	}
}

// ── Per-owner list queries ────────────────────────────────────────────────────

async function listSessionsForBooking(bookingId: string): Promise<Session[]> {
	const rows = await db
		.select(SESSION_COLS)
		.from(sessions)
		.where(and(eq(sessions.bookingId, bookingId), eq(sessions.ownerType, 'booking')))
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);
	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	return attachParticipants(wi);
}

async function listSessionsForServiceOnDate(serviceId: string, date: string): Promise<Session[]> {
	const rows = await db
		.select(SESSION_COLS)
		.from(sessions)
		.where(and(eq(sessions.serviceId, serviceId), eq(sessions.date, date), eq(sessions.ownerType, 'service')))
		.orderBy(sessions.sortOrder, sessions.time);
	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	return attachParticipants(wi);
}

export async function listSessionsForService(
	serviceId: string, from?: string, to?: string
): Promise<Session[]> {
	const conditions = [eq(sessions.serviceId, serviceId), eq(sessions.ownerType, 'service')];
	if (from) conditions.push(gte(sessions.date, from));
	if (to)   conditions.push(lte(sessions.date, to));
	const rows = await db
		.select(SESSION_COLS)
		.from(sessions)
		.where(and(...conditions))
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);
	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	return attachParticipants(wi);
}

export async function listSessionsForEdition(editionId: string): Promise<Session[]> {
	const rows = await db
		.select(SESSION_COLS)
		.from(sessions)
		.where(and(eq(sessions.serviceEditionId, editionId), eq(sessions.ownerType, 'edition')))
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);
	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	return attachParticipants(wi);
}
```

- [ ] **Step 4: Write enrollment queries**

```ts
// ── Group class enrollment (bookings.session_id — no junction table) ──────────

export async function listEnrollmentsForSession(sessionId: string): Promise<BookingEnrollment[]> {
	return db.select({
		bookingId:   bookings.id,
		clientId:    bookingClients.clientId,
		firstName:   clients.firstName,
		lastName:    clients.lastName,
		amountDue:   bookingClients.amountDue,
		amountPaid:  bookingClients.amountPaid,
		status:      bookingClients.status
	})
	.from(bookings)
	.innerJoin(bookingClients, eq(bookingClients.bookingId, bookings.id))
	.innerJoin(clients, eq(bookingClients.clientId, clients.id))
	.where(and(eq(bookings.sessionId, sessionId), ne(bookings.status, 'cancelled')));
}

export async function listUnassignedEnrollments(serviceId: string, date: string) {
	return db.select({
		bookingId:   bookings.id,
		clientId:    bookingClients.clientId,
		firstName:   clients.firstName,
		lastName:    clients.lastName,
		status:      bookings.status
	})
	.from(bookings)
	.innerJoin(bookingClients, eq(bookingClients.bookingId, bookings.id))
	.innerJoin(clients, eq(bookingClients.clientId, clients.id))
	.where(and(
		eq(bookings.serviceId, serviceId),
		eq(bookings.date, date),
		isNull(bookings.sessionId),
		ne(bookings.status, 'cancelled'),
		eq(bookingClients.status, 'enrolled')
	));
}

// App-level guard: session.service_id must match booking.service_id
export async function assignBookingToSession(bookingId: string, sessionId: string | null): Promise<void> {
	if (sessionId !== null) {
		const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
		const [booking] = await db.select({ serviceId: bookings.serviceId }).from(bookings).where(eq(bookings.id, bookingId));
		if (!session || session.ownerType !== 'service' || session.serviceId !== booking?.serviceId)
			throw new Error('Session does not belong to this booking\'s service');
	}
	await db.update(bookings).set({ sessionId }).where(eq(bookings.id, bookingId));
}
```

- [ ] **Step 5: Write `createSession`, `getSession`, `updateSession`, `cancelSession`, `deleteSession` + delete helpers**

```ts
// ── Core CRUD ────────────────────────────────────────────────────────────────

export async function getSession(id: string): Promise<Session | undefined> {
	const [row] = await db.select(SESSION_COLS).from(sessions).where(eq(sessions.id, id));
	if (!row) return undefined;
	const [wi] = await attachInstructors([row as Omit<Session, 'instructors' | 'participants'>]);
	const [wb] = await attachParticipants([wi]);
	return wb;
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
	const ownerCols =
		input.ownerType === 'booking'  ? { bookingId: input.bookingId, serviceId: null, serviceEditionId: null } :
		input.ownerType === 'service'  ? { serviceId: input.serviceId, bookingId: null, serviceEditionId: null } :
		                                 { serviceEditionId: input.editionId, bookingId: null, serviceId: null };

	const [row] = await db.insert(sessions).values({
		ownerType: input.ownerType,
		...ownerCols,
		date: input.date,
		time: input.time ?? null,
		durationMinutes: input.durationMinutes ?? null,
		notes: input.notes ?? null,
		status: input.time ? 'scheduled' : 'unscheduled',
		sortOrder: input.sortOrder ?? 0,
		skillLevel: input.skillLevel ?? null
	}).returning();

	if (input.instructorIds?.length) {
		await db.insert(sessionInstructors).values(
			input.instructorIds.map(instructorId => ({ sessionId: row.id, instructorId }))
		);
	}

	if (input.ownerType === 'edition') {
		await syncParticipantsToEditionSession(row.id, input.editionId);
	}

	return (await getSession(row.id))!;
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session> {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (input.date !== undefined)            updates.date = input.date;
	if (input.time !== undefined)            { updates.time = input.time; updates.status = input.time ? 'scheduled' : 'unscheduled'; }
	if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
	if (input.notes !== undefined)           updates.notes = input.notes;
	if (input.status !== undefined)          updates.status = input.status;
	if (input.sortOrder !== undefined)       updates.sortOrder = input.sortOrder;
	if (input.skillLevel !== undefined)      updates.skillLevel = input.skillLevel;
	await db.update(sessions).set(updates).where(eq(sessions.id, id));

	if (input.instructorIds !== undefined) {
		await db.delete(sessionInstructors).where(eq(sessionInstructors.sessionId, id));
		if (input.instructorIds.length > 0) {
			await db.insert(sessionInstructors).values(
				input.instructorIds.map(instructorId => ({ sessionId: id, instructorId }))
			);
		}
	}
	return (await getSession(id))!;
}

export async function cancelSession(id: string): Promise<void> {
	await db.update(sessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, id));
}

export async function deleteSessionsForBooking(bookingId: string): Promise<void> {
	await db.delete(sessions)
		.where(and(eq(sessions.bookingId, bookingId), eq(sessions.ownerType, 'booking')));
}

export async function deleteSessionsForEdition(editionId: string): Promise<void> {
	await db.delete(sessions)
		.where(and(eq(sessions.serviceEditionId, editionId), eq(sessions.ownerType, 'edition')));
}

export async function deleteSessionsForServiceOnDate(serviceId: string, date: string): Promise<void> {
	await db.delete(sessions)
		.where(and(eq(sessions.serviceId, serviceId), eq(sessions.date, date), eq(sessions.ownerType, 'service')));
}
```

- [ ] **Step 6: Write bulk generate functions + shared `buildDateSlots` helper**

```ts
// ── Bulk generate ─────────────────────────────────────────────────────────────

interface DateSlot { date: string; time: string | undefined }

function buildDateSlots(start: string, end: string, opts: BulkGenOptions): DateSlot[] {
	const slots: DateSlot[] = [];
	const cur = new Date(start + 'T12:00:00Z');
	const endDate = new Date(end + 'T12:00:00Z');

	while (cur <= endDate) {
		const dow = cur.getUTCDay(); // 0=Sun, 6=Sat
		if (!opts.weekdaysOnly || (dow >= 1 && dow <= 5)) {
			for (let i = 0; i < opts.sessionsPerDay; i++) {
				slots.push({
					date: cur.toISOString().slice(0, 10),
					time: opts.times[i]
				});
			}
		}
		cur.setUTCDate(cur.getUTCDate() + 1);
	}
	return slots;
}

export async function bulkGenerateSessionsForBooking(
	bookingId: string,
	booking: { date: string; dateEnd: string | null },
	opts: BulkGenOptions
): Promise<void> {
	if (opts.clearExisting) await deleteSessionsForBooking(bookingId);

	const slots = buildDateSlots(booking.date, booking.dateEnd ?? booking.date, opts);
	for (const slot of slots) {
		await createSession({
			ownerType: 'booking',
			bookingId,
			date: slot.date,
			time: slot.time,
			durationMinutes: opts.durationMinutes
		});
	}
}

export async function bulkGenerateSessionsForEdition(
	editionId: string,
	edition: { startDate: string; endDate: string },
	opts: BulkGenOptions
): Promise<void> {
	if (opts.clearExisting) await deleteSessionsForEdition(editionId);

	const slots = buildDateSlots(edition.startDate, edition.endDate, opts);
	for (const slot of slots) {
		await createSession({
			ownerType: 'edition',
			editionId,
			date: slot.date,
			time: slot.time,
			durationMinutes: opts.durationMinutes
		});
	}
}
```

- [ ] **Step 7: Write calendar/agenda queries (rewrite `listSessionsForDate` + `listSessionsForDateRange`)**

```ts
// ── Calendar queries ──────────────────────────────────────────────────────────

export async function listSessionsForDate(date: string, instructorId?: string): Promise<SessionForDay[]> {
	const baseWhere = instructorId
		? and(eq(sessions.date, date), ne(sessions.status, 'cancelled'),
			sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`)
		: and(eq(sessions.date, date), ne(sessions.status, 'cancelled'));

	const rows = await db.select(SESSION_COLS).from(sessions).where(baseWhere)
		.orderBy(sessions.sortOrder, sessions.time);
	if (rows.length === 0) return [];

	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	const wb = await attachParticipants(wi);
	return enrichSessionsForCalendar(wb as Session[]);
}

export async function listSessionsForDateRange(
	from: string, to: string, instructorId?: string
): Promise<AgendaSession[]> {
	const baseWhere = instructorId
		? and(gte(sessions.date, from), lte(sessions.date, to), ne(sessions.status, 'cancelled'),
			sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`)
		: and(gte(sessions.date, from), lte(sessions.date, to), ne(sessions.status, 'cancelled'));

	const rows = await db.select(SESSION_COLS).from(sessions).where(baseWhere)
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);
	if (rows.length === 0) return [];

	const wi = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	const wb = await attachParticipants(wi);
	return enrichSessionsForAgenda(wb as Session[]);
}

async function enrichSessionsForCalendar(rows: Session[]): Promise<SessionForDay[]> {
	const byType: Record<SessionOwnerType, Session[]> = { booking: [], service: [], edition: [] };
	for (const s of rows) (byType[s.ownerType] ??= []).push(s);

	const [b, svc, ed] = await Promise.all([
		enrichBookingOwnedForCalendar(byType.booking),
		enrichServiceOwnedForCalendar(byType.service),
		enrichEditionOwnedForCalendar(byType.edition),
	]);
	return [...b, ...svc, ...ed].sort((a, b) =>
		a.sortOrder - b.sortOrder || (a.time ?? '').localeCompare(b.time ?? ''));
}

async function enrichSessionsForAgenda(rows: Session[]): Promise<AgendaSession[]> {
	const byType: Record<SessionOwnerType, Session[]> = { booking: [], service: [], edition: [] };
	for (const s of rows) (byType[s.ownerType] ??= []).push(s);

	const [b, svc, ed] = await Promise.all([
		enrichBookingOwnedForAgenda(byType.booking),
		enrichServiceOwnedForAgenda(byType.service),
		enrichEditionOwnedForAgenda(byType.edition),
	]);
	return [...b, ...svc, ...ed].sort((a, b) =>
		(a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

async function enrichBookingOwnedForCalendar(rows: Session[]): Promise<SessionForDay[]> {
	if (rows.length === 0) return [];
	const bookingIds = rows.map(s => s.bookingId!);
	const bRows = await db.select({
		id: bookings.id,
		status: bookings.status,
		serviceId: bookings.serviceId
	}).from(bookings).where(inArray(bookings.id, bookingIds));
	const svcIds = [...new Set(bRows.map(b => b.serviceId).filter(Boolean))] as string[];
	const svcRows = svcIds.length > 0
		? await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes })
			.from(services).where(inArray(services.id, svcIds))
		: [];

	const bookingMap = Object.fromEntries(bRows.map(b => [b.id, b]));
	const svcMap    = Object.fromEntries(svcRows.map(s => [s.id, s]));

	// Client names from booking_clients
	const clientRows = bookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName, lastName: clients.lastName })
			.from(bookingClients).innerJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, bookingIds), eq(bookingClients.status, 'enrolled')))
		: [];
	const clientsByBooking: Record<string, string[]> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(`${r.firstName} ${r.lastName}`);

	// Payment totals
	const payRows = bookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, due: sum(bookingClients.amountDue), paid: sum(bookingClients.amountPaid) })
			.from(bookingClients).where(inArray(bookingClients.bookingId, bookingIds)).groupBy(bookingClients.bookingId)
		: [];
	const payMap: Record<string, { due: number; paid: number }> = {};
	for (const r of payRows) payMap[r.bookingId] = { due: parseFloat(r.due ?? '0'), paid: parseFloat(r.paid ?? '0') };

	return rows.map(s => {
		const bk = bookingMap[s.bookingId!];
		const sv = bk?.serviceId ? svcMap[bk.serviceId] : null;
		const pNames = s.participants.length > 0
			? [...new Set(s.participants.map(p => p.name))]
			: clientsByBooking[s.bookingId!] ?? [];
		return {
			...s,
			primaryBookingId: s.bookingId,
			bookingIds: [s.bookingId!],
			editionId: null,
			bookingStatus: bk?.status ?? null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasSessions: 'sessions' in (sv?.modules ?? {}),
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			participantNames: pNames,
			totalParticipants: pNames.length,
			totalAmountDue: payMap[s.bookingId!]?.due ?? 0,
			totalAmountPaid: payMap[s.bookingId!]?.paid ?? 0
		} satisfies SessionForDay;
	});
}

async function enrichServiceOwnedForCalendar(rows: Session[]): Promise<SessionForDay[]> {
	if (rows.length === 0) return [];
	const sessionIds = rows.map(s => s.id);
	const svcIds = [...new Set(rows.map(s => s.serviceId!))];
	const svcRows = await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes })
		.from(services).where(inArray(services.id, svcIds));
	const svcMap = Object.fromEntries(svcRows.map(s => [s.id, s]));

	// Enrolled bookings — direct FK, no junction
	const enrolledBookings = sessionIds.length > 0
		? await db.select({ sessionId: bookings.sessionId, bookingId: bookings.id, status: bookings.status })
			.from(bookings).where(and(inArray(bookings.sessionId, sessionIds), ne(bookings.status, 'cancelled')))
		: [];
	const enrolledBySession: Record<string, string[]> = {};
	for (const b of enrolledBookings) (enrolledBySession[b.sessionId!] ??= []).push(b.bookingId);

	// Payment totals
	const enrolledBookingIds = enrolledBookings.map(b => b.bookingId);
	const payRows = enrolledBookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, due: sum(bookingClients.amountDue), paid: sum(bookingClients.amountPaid) })
			.from(bookingClients).where(inArray(bookingClients.bookingId, enrolledBookingIds)).groupBy(bookingClients.bookingId)
		: [];
	const payMap: Record<string, { due: number; paid: number }> = {};
	for (const r of payRows) payMap[r.bookingId] = { due: parseFloat(r.due ?? '0'), paid: parseFloat(r.paid ?? '0') };

	return rows.map(s => {
		const sv = svcMap[s.serviceId!];
		const bIds = enrolledBySession[s.id] ?? [];
		const pNames = s.participants.length > 0 ? [...new Set(s.participants.map(p => p.name))] : [];
		const totalDue  = bIds.reduce((acc, id) => acc + (payMap[id]?.due ?? 0), 0);
		const totalPaid = bIds.reduce((acc, id) => acc + (payMap[id]?.paid ?? 0), 0);
		return {
			...s,
			primaryBookingId: bIds[0] ?? null,
			bookingIds: bIds,
			editionId: null,
			bookingStatus: null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasSessions: true,
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			participantNames: pNames,
			totalParticipants: pNames.length || bIds.length,
			totalAmountDue: totalDue,
			totalAmountPaid: totalPaid
		} satisfies SessionForDay;
	});
}

async function enrichEditionOwnedForCalendar(rows: Session[]): Promise<SessionForDay[]> {
	if (rows.length === 0) return [];
	const editionIds = [...new Set(rows.map(s => s.serviceEditionId!))];
	const edRows = await db.select({ id: serviceEditions.id, serviceId: serviceEditions.serviceId })
		.from(serviceEditions).where(inArray(serviceEditions.id, editionIds));
	const edMap = Object.fromEntries(edRows.map(e => [e.id, e]));
	const svcIds = [...new Set(edRows.map(e => e.serviceId))];
	const svcRows = svcIds.length > 0
		? await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes })
			.from(services).where(inArray(services.id, svcIds))
		: [];
	const svcMap = Object.fromEntries(svcRows.map(s => [s.id, s]));

	// All non-cancelled bookings for these editions (for bookingIds list)
	const editionBookings = editionIds.length > 0
		? await db.select({ bookingId: bookings.id, editionId: bookings.serviceEditionId })
			.from(bookings).where(and(inArray(bookings.serviceEditionId, editionIds), ne(bookings.status, 'cancelled')))
		: [];
	const bookingsByEdition: Record<string, string[]> = {};
	for (const b of editionBookings) (bookingsByEdition[b.editionId!] ??= []).push(b.bookingId);

	// Payment totals across all edition bookings
	const allEditionBookingIds = editionBookings.map(b => b.bookingId);
	const payRows = allEditionBookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, due: sum(bookingClients.amountDue), paid: sum(bookingClients.amountPaid) })
			.from(bookingClients).where(inArray(bookingClients.bookingId, allEditionBookingIds)).groupBy(bookingClients.bookingId)
		: [];
	const payMap: Record<string, { due: number; paid: number }> = {};
	for (const r of payRows) payMap[r.bookingId] = { due: parseFloat(r.due ?? '0'), paid: parseFloat(r.paid ?? '0') };

	return rows.map(s => {
		const ed = edMap[s.serviceEditionId!];
		const sv = ed ? svcMap[ed.serviceId] : null;
		const bIds = ed ? bookingsByEdition[ed.id] ?? [] : [];
		const pNames = s.participants.length > 0 ? [...new Set(s.participants.map(p => p.name))] : [];
		const totalDue  = bIds.reduce((acc, id) => acc + (payMap[id]?.due ?? 0), 0);
		const totalPaid = bIds.reduce((acc, id) => acc + (payMap[id]?.paid ?? 0), 0);
		return {
			...s,
			primaryBookingId: null,
			bookingIds: bIds,
			editionId: s.serviceEditionId,
			bookingStatus: null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasSessions: true,
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			participantNames: pNames,
			totalParticipants: pNames.length || bIds.length,
			totalAmountDue: totalDue,
			totalAmountPaid: totalPaid
		} satisfies SessionForDay;
	});
}

// Agenda enrichers (similar shape, more fields)
async function enrichBookingOwnedForAgenda(rows: Session[]): Promise<AgendaSession[]> {
	if (rows.length === 0) return [];
	const bookingIds = rows.map(s => s.bookingId!);
	const bRows = await db.select({
		id: bookings.id, status: bookings.status, serviceId: bookings.serviceId,
		date: bookings.date, dateEnd: bookings.dateEnd, isFlexible: bookings.isFlexible,
		sessionsIncluded: bookings.sessionsIncluded
	}).from(bookings).where(inArray(bookings.id, bookingIds));

	const svcIds = [...new Set(bRows.map(b => b.serviceId).filter(Boolean))] as string[];
	const svcRows = svcIds.length > 0
		? await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes, maxCapacity: services.maxCapacity })
			.from(services).where(inArray(services.id, svcIds))
		: [];
	const bookingMap = Object.fromEntries(bRows.map(b => [b.id, b]));
	const svcMap    = Object.fromEntries(svcRows.map(s => [s.id, s]));

	const clientRows = bookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, clientId: bookingClients.clientId, firstName: clients.firstName, lastName: clients.lastName, phone: clients.phone, amountDue: bookingClients.amountDue, amountPaid: bookingClients.amountPaid, participantCount: bookingClients.participantCount })
			.from(bookingClients).leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, bookingIds), eq(bookingClients.status, 'enrolled')))
		: [];
	const clientsByBooking: Record<string, typeof clientRows> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(r);

	return rows.map(s => {
		const bk = bookingMap[s.bookingId!];
		const sv = bk?.serviceId ? svcMap[bk.serviceId] : null;
		const bc = clientsByBooking[s.bookingId!] ?? [];
		const pNames = s.participants.length > 0
			? [...new Set(s.participants.map(p => p.name))]
			: bc.map(c => `${c.firstName} ${c.lastName}`);
		return {
			...s,
			primaryBookingId: s.bookingId,
			bookingIds: [s.bookingId!],
			editionId: null,
			bookingStatus: bk?.status ?? null,
			bookingDate: bk?.date ?? s.date,
			bookingDateEnd: bk?.dateEnd ?? null,
			isFlexible: bk?.isFlexible ?? false,
			sessionsIncluded: bk?.sessionsIncluded ?? null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasRoster: 'roster' in (sv?.modules ?? {}),
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			firstClientName: bc[0] ? `${bc[0].firstName} ${bc[0].lastName}` : null,
			participantNames: pNames,
			totalParticipants: s.participants.length > 0 ? pNames.length : bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			enrolledCount: bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			maxCapacity: sv?.maxCapacity ?? null,
			totalAmountDue:  bc.reduce((a, c) => a + parseFloat(c.amountDue ?? '0'), 0),
			totalAmountPaid: bc.reduce((a, c) => a + parseFloat(c.amountPaid ?? '0'), 0)
		} satisfies AgendaSession;
	});
}

async function enrichServiceOwnedForAgenda(rows: Session[]): Promise<AgendaSession[]> {
	if (rows.length === 0) return [];
	const svcIds = [...new Set(rows.map(s => s.serviceId!))];
	const svcRows = await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes, maxCapacity: services.maxCapacity })
		.from(services).where(inArray(services.id, svcIds));
	const svcMap = Object.fromEntries(svcRows.map(s => [s.id, s]));
	const sessionIds = rows.map(s => s.id);

	const enrolledBookings = sessionIds.length > 0
		? await db.select({ sessionId: bookings.sessionId, bookingId: bookings.id, status: bookings.status, date: bookings.date, dateEnd: bookings.dateEnd, isFlexible: bookings.isFlexible, sessionsIncluded: bookings.sessionsIncluded })
			.from(bookings).where(and(inArray(bookings.sessionId, sessionIds), ne(bookings.status, 'cancelled')))
		: [];
	const enrolledBySession: Record<string, typeof enrolledBookings> = {};
	for (const b of enrolledBookings) (enrolledBySession[b.sessionId!] ??= []).push(b);

	const enrolledBookingIds = enrolledBookings.map(b => b.bookingId);
	const clientRows = enrolledBookingIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName, lastName: clients.lastName, amountDue: bookingClients.amountDue, amountPaid: bookingClients.amountPaid, participantCount: bookingClients.participantCount })
			.from(bookingClients).leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, enrolledBookingIds), eq(bookingClients.status, 'enrolled')))
		: [];
	const clientsByBooking: Record<string, typeof clientRows> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(r);

	return rows.map(s => {
		const sv  = svcMap[s.serviceId!];
		const bks = enrolledBySession[s.id] ?? [];
		const bc  = bks.flatMap(b => clientsByBooking[b.bookingId] ?? []);
		const pNames = s.participants.length > 0 ? [...new Set(s.participants.map(p => p.name))] : [];
		return {
			...s,
			primaryBookingId: bks[0]?.bookingId ?? null,
			bookingIds: bks.map(b => b.bookingId),
			editionId: null,
			bookingStatus: bks[0]?.status ?? null,
			bookingDate: bks[0]?.date ?? s.date,
			bookingDateEnd: bks[0]?.dateEnd ?? null,
			isFlexible: bks[0]?.isFlexible ?? false,
			sessionsIncluded: null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasRoster: 'roster' in (sv?.modules ?? {}),
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			firstClientName: bc[0] ? `${bc[0].firstName} ${bc[0].lastName}` : null,
			participantNames: pNames,
			totalParticipants: pNames.length || bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			enrolledCount: bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			maxCapacity: sv?.maxCapacity ?? null,
			totalAmountDue:  bc.reduce((a, c) => a + parseFloat(c.amountDue ?? '0'), 0),
			totalAmountPaid: bc.reduce((a, c) => a + parseFloat(c.amountPaid ?? '0'), 0)
		} satisfies AgendaSession;
	});
}

async function enrichEditionOwnedForAgenda(rows: Session[]): Promise<AgendaSession[]> {
	if (rows.length === 0) return [];
	const editionIds = [...new Set(rows.map(s => s.serviceEditionId!))];
	const edRows = await db.select({ id: serviceEditions.id, serviceId: serviceEditions.serviceId, startDate: serviceEditions.startDate, endDate: serviceEditions.endDate })
		.from(serviceEditions).where(inArray(serviceEditions.id, editionIds));
	const edMap  = Object.fromEntries(edRows.map(e => [e.id, e]));
	const svcIds = [...new Set(edRows.map(e => e.serviceId))];
	const svcRows = svcIds.length > 0
		? await db.select({ id: services.id, name: services.name, color: services.color, modules: services.modules, durationMinutes: services.durationMinutes, maxCapacity: services.maxCapacity })
			.from(services).where(inArray(services.id, svcIds))
		: [];
	const svcMap = Object.fromEntries(svcRows.map(s => [s.id, s]));

	const editionBookings = editionIds.length > 0
		? await db.select({ bookingId: bookings.id, editionId: bookings.serviceEditionId, status: bookings.status, date: bookings.date, dateEnd: bookings.dateEnd, isFlexible: bookings.isFlexible, sessionsIncluded: bookings.sessionsIncluded })
			.from(bookings).where(and(inArray(bookings.serviceEditionId, editionIds), ne(bookings.status, 'cancelled')))
		: [];
	const bookingsByEdition: Record<string, typeof editionBookings> = {};
	for (const b of editionBookings) (bookingsByEdition[b.editionId!] ??= []).push(b);

	const allBIds = editionBookings.map(b => b.bookingId);
	const clientRows = allBIds.length > 0
		? await db.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName, lastName: clients.lastName, amountDue: bookingClients.amountDue, amountPaid: bookingClients.amountPaid, participantCount: bookingClients.participantCount })
			.from(bookingClients).leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, allBIds), eq(bookingClients.status, 'enrolled')))
		: [];
	const clientsByBooking: Record<string, typeof clientRows> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(r);

	return rows.map(s => {
		const ed  = edMap[s.serviceEditionId!];
		const sv  = ed ? svcMap[ed.serviceId] : null;
		const bks = ed ? bookingsByEdition[ed.id] ?? [] : [];
		const bc  = bks.flatMap(b => clientsByBooking[b.bookingId] ?? []);
		const pNames = s.participants.length > 0 ? [...new Set(s.participants.map(p => p.name))] : [];
		return {
			...s,
			primaryBookingId: null,
			bookingIds: bks.map(b => b.bookingId),
			editionId: s.serviceEditionId,
			bookingStatus: null,
			bookingDate: ed?.startDate ?? s.date,
			bookingDateEnd: ed?.endDate ?? null,
			isFlexible: false,
			sessionsIncluded: null,
			serviceName: sv?.name ?? null,
			serviceColor: sv?.color ?? null,
			serviceHasRoster: true,
			serviceDurationMinutes: sv?.durationMinutes ?? null,
			effectiveDuration: s.durationMinutes ?? sv?.durationMinutes ?? 60,
			firstClientName: bc[0] ? `${bc[0].firstName} ${bc[0].lastName}` : null,
			participantNames: pNames,
			totalParticipants: pNames.length || bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			enrolledCount: bc.reduce((a, c) => a + (c.participantCount ?? 1), 0),
			maxCapacity: sv?.maxCapacity ?? null,
			totalAmountDue:  bc.reduce((a, c) => a + parseFloat(c.amountDue ?? '0'), 0),
			totalAmountPaid: bc.reduce((a, c) => a + parseFloat(c.amountPaid ?? '0'), 0)
		} satisfies AgendaSession;
	});
}
```

- [ ] **Step 8: Write participant sync + routing helper + re-export participant functions**

```ts
// ── Edition participant sync ───────────────────────────────────────────────────

export async function syncParticipantsToEditionSession(
	sessionId: string, editionId: string
): Promise<void> {
	// All booking_participants for all non-cancelled bookings in this edition
	const editionBPs = await db
		.select({
			id: bookingParticipants.id,
			name: bookingParticipants.name,
			sortOrder: bookingParticipants.sortOrder
		})
		.from(bookingParticipants)
		.innerJoin(bookingClients, eq(bookingParticipants.bookingClientId, bookingClients.id))
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(and(
			eq(bookings.serviceEditionId, editionId),
			ne(bookings.status, 'cancelled'),
			eq(bookingClients.status, 'enrolled')
		));

	if (editionBPs.length === 0) return;

	await db.insert(sessionParticipants)
		.values(editionBPs.map((bp, i) => ({
			id: crypto.randomUUID(),
			sessionId,
			bookingParticipantId: bp.id,
			name: bp.name,
			sortOrder: bp.sortOrder ?? i
		})))
		.onConflictDoNothing(); // partial unique on (session_id, booking_participant_id) prevents duplicates
}

export async function syncAllParticipantsToEditionSessions(editionId: string): Promise<void> {
	const editionSessions = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(and(eq(sessions.serviceEditionId, editionId), ne(sessions.status, 'cancelled')));

	await Promise.all(
		editionSessions.map(s => syncParticipantsToEditionSession(s.id, editionId))
	);
}

// ── Calendar routing helper ───────────────────────────────────────────────────

export function sessionDetailLink(
	session: Pick<SessionForDay, 'ownerType' | 'primaryBookingId' | 'serviceId' | 'editionId'>
): string {
	switch (session.ownerType) {
		case 'booking':  return `/bookings/${session.primaryBookingId}`;
		case 'service':  return `/services/${session.serviceId}/sessions/`;
		case 'edition':  return `/services/${session.serviceId}/roster?run=${session.editionId}`;
	}
}

// ── Session participants (keep existing, same as before) ─────────────────────

export async function listParticipantsForSession(sessionId: string): Promise<SessionParticipant[]> {
	return db.select({ id: sessionParticipants.id, sessionId: sessionParticipants.sessionId, bookingParticipantId: sessionParticipants.bookingParticipantId, name: sessionParticipants.name, notes: sessionParticipants.notes, sortOrder: sessionParticipants.sortOrder })
		.from(sessionParticipants).where(eq(sessionParticipants.sessionId, sessionId)).orderBy(sessionParticipants.sortOrder);
}

export async function addParticipant(input: CreateParticipantInput): Promise<SessionParticipant | null> {
	const [row] = await db.insert(sessionParticipants)
		.values({ id: crypto.randomUUID(), sessionId: input.sessionId, bookingParticipantId: input.bookingParticipantId ?? null, name: input.name.trim(), notes: input.notes ?? null, sortOrder: input.sortOrder ?? 0 })
		.onConflictDoNothing().returning();
	return row ?? null;
}

export async function removeParticipant(participantId: string): Promise<void> {
	await db.delete(sessionParticipants).where(eq(sessionParticipants.id, participantId));
}

export async function renameSessionParticipantsByBookingParticipantId(bookingParticipantId: string, name: string): Promise<void> {
	await db.update(sessionParticipants).set({ name }).where(eq(sessionParticipants.bookingParticipantId, bookingParticipantId));
}

// ── Unscheduled sessions (for calendar agenda strip) ─────────────────────────

export async function listUnscheduledSessions(from: string, to: string): Promise<(Session & {
	primaryBookingId: string | null; serviceName: string | null; serviceColor: string | null;
})[]> {
	const rows = await db.select(SESSION_COLS).from(sessions)
		.where(and(eq(sessions.status, 'unscheduled'), gte(sessions.date, from), lte(sessions.date, to)))
		.orderBy(sessions.date, sessions.sortOrder);
	if (rows.length === 0) return [];

	const sRows = rows as Session[];
	const bookingIds = sRows.filter(s => s.bookingId).map(s => s.bookingId!);
	const svcLookup: Record<string, { name: string | null; color: string | null }> = {};

	if (bookingIds.length > 0) {
		const bRows = await db.select({ id: bookings.id, serviceId: bookings.serviceId }).from(bookings).where(inArray(bookings.id, bookingIds));
		const svcIds = [...new Set(bRows.map(b => b.serviceId).filter(Boolean))] as string[];
		const svcs = svcIds.length > 0 ? await db.select({ id: services.id, name: services.name, color: services.color }).from(services).where(inArray(services.id, svcIds)) : [];
		const svcMap = Object.fromEntries(svcs.map(s => [s.id, s]));
		for (const b of bRows) svcLookup[b.id] = svcMap[b.serviceId!] ?? { name: null, color: null };
	}

	const wi = await attachInstructors(sRows as Omit<Session, 'instructors' | 'participants'>[]);
	return wi.map(s => ({
		...s,
		participants: [],
		primaryBookingId: s.bookingId ?? null,
		serviceName: s.bookingId ? svcLookup[s.bookingId]?.name ?? null : null,
		serviceColor: s.bookingId ? svcLookup[s.bookingId]?.color ?? null : null
	}));
}
```

- [ ] **Step 9: Verify the file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "sessions/queries"
```

Expected: no output.

---

## Task 6: Update `bookings/types.ts` + `bookings/queries.ts`

**Files:**
- Modify: `src/lib/features/bookings/types.ts`
- Modify: `src/lib/features/bookings/queries.ts`

- [ ] **Step 1: Add `sessionId` to `Booking` interface in `bookings/types.ts`**

In the `Booking` interface, add after `sessionsIncluded`:

```ts
sessionId: string | null;
```

Also remove the JSDoc comment on `bookingIdTemp` (it no longer exists in DB):

```ts
// Remove from BookingParticipant:
/** Temporary migration column — do not use */
bookingIdTemp?: string | null;
```

- [ ] **Step 2: Add `sessionId` to `getBooking` query in `bookings/queries.ts`**

Find the `getBooking` function. In its select statement, add `sessionId: bookings.sessionId` to the selected columns, and ensure the returned `Booking` object includes `sessionId: row.sessionId ?? null`.

Search for where `sessionsIncluded` is selected and add `sessionId` next to it. The pattern varies — find the object spread that builds the Booking return value and add `sessionId: b.sessionId ?? null`.

- [ ] **Step 3: Make `recalcBookingAmounts` edition-aware**

Find `recalcBookingAmounts` in `bookings/queries.ts`. Currently it uses `booking.sessionsIncluded` for session count. Add edition-aware logic:

```ts
// At top of recalcBookingAmounts, after fetching the booking:
let effectiveSessions = booking.sessionsIncluded ?? 0;

// If this is an edition booking, use live session count instead
if (booking.serviceEditionId && booking.serviceModules && 'editions' in booking.serviceModules) {
  const [{ cnt }] = await db
    .select({ cnt: sql<string>`COUNT(*)` })
    .from(sessions)
    .where(and(
      eq(sessions.serviceEditionId, booking.serviceEditionId),
      eq(sessions.ownerType, 'edition'),
      ne(sessions.status, 'cancelled')
    ));
  effectiveSessions = parseInt(cnt) || 0;
}

// Replace all uses of booking.sessionsIncluded with effectiveSessions in the calculation below
```

Add the `sessions` import at top of `bookings/queries.ts` if not already present:

```ts
import { sessions } from '$lib/server/db/schema';
```

- [ ] **Step 4: Add `recalcEditionBookingAmounts` fan-out function**

Add after `recalcBookingAmounts`:

```ts
export async function recalcEditionBookingAmounts(editionId: string): Promise<void> {
  const editionBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.serviceEditionId, editionId), ne(bookings.status, 'cancelled')));

  await Promise.all(editionBookings.map(b => recalcBookingAmounts(b.id)));
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "bookings/"
```

Expected: no errors from bookings files.

---

## Task 7: Update booking detail route

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 1: Update imports in `+page.server.ts`**

Replace the sessions imports block:

```ts
// Old:
import {
  listSessionsForBooking,
  listSessionsForDate,
  createSession,
  updateSession,
  cancelSession,
  deleteSession,
  deleteSessionsForBooking,
  linkSessionToBooking,
  unlinkSessionFromBooking,
  addParticipant,
  removeParticipant,
  renameSessionParticipantsByBookingParticipantId
} from '$lib/features/sessions/queries';

// New:
import {
  listSessionsForContext,
  resolveSessionContext,
  assignBookingToSession,
  listUnassignedEnrollments,
  createSession,
  updateSession,
  cancelSession,
  deleteSession,
  deleteSessionsForBooking,
  addParticipant,
  removeParticipant,
  renameSessionParticipantsByBookingParticipantId,
  syncAllParticipantsToEditionSessions
} from '$lib/features/sessions/queries';
import { recalcEditionBookingAmounts } from '$lib/features/bookings/queries';
```

- [ ] **Step 2: Update the `load` function**

Replace:

```ts
hasSessions ? listSessionsForBooking(params.id) : Promise.resolve([]),
// For "link to existing session": sessions on booking's start date from other bookings
hasSessions ? listSessionsForDate(booking.date) : Promise.resolve([])
```

With:

```ts
hasSessions ? listSessionsForContext(booking) : Promise.resolve([]),
Promise.resolve([])  // linkableSessions: not used for non-booking sessions
```

After building the load return, add `sessionOwnerType`:

```ts
const ctx = hasSessions ? resolveSessionContext(booking) : null;

return {
  ...,  // existing fields
  sessions,
  sessionOwnerType: ctx?.type ?? null,
  // Remove linkableSessions from return (no longer needed)
};
```

- [ ] **Step 3: Guard session write actions**

In the `addSession` action, add at top:

```ts
const booking = await getBooking(params.id);
if (!booking) return fail(404, { error: 'Not found' });
const ctx = resolveSessionContext(booking);
if (ctx.type !== 'booking') return fail(400, { error: 'Sessions are managed at the service level for this booking type' });
```

In the `bulkGenerateSessions` action, same guard.

For `cancelSession` and `deleteSession` actions — after they run, if edition booking, call fan-out:

```ts
const booking = await getBooking(params.id);
if (booking?.serviceEditionId && 'editions' in (booking.serviceModules ?? {})) {
  await recalcEditionBookingAmounts(booking.serviceEditionId);
}
```

For `addBookingParticipant`, `setParticipantCount`, `syncParticipantsToSessions` — add after execution:

```ts
if (booking?.serviceEditionId) {
  await syncAllParticipantsToEditionSessions(booking.serviceEditionId);
}
```

- [ ] **Step 4: Add new actions `assignToSession` and `unassignFromSession`**

```ts
assignToSession: async ({ request, params, locals }) => {
  requireRole(locals, 'admin', 'owner', 'manager');
  const form   = await request.formData();
  const sessionId = form.get('sessionId')?.toString() ?? '';
  if (!sessionId) return fail(400, { error: 'sessionId required' });
  try {
    await assignBookingToSession(params.id, sessionId);
  } catch (e) {
    return fail(400, { error: (e as Error).message });
  }
  return { error: null, message: 'Asignado a sesión' };
},

unassignFromSession: async ({ params, locals }) => {
  requireRole(locals, 'admin', 'owner', 'manager');
  await assignBookingToSession(params.id, null);
  return { error: null, message: 'Desasignado' };
},
```

- [ ] **Step 5: Update `+page.svelte` to pass `sessionOwnerType`**

Find where `BookingDetailCard` (the sessions module card) is rendered and add the `sessionOwnerType` prop:

```svelte
<BookingDetailCard
  booking={data.booking}
  modules={data.booking.serviceModules}
  sessions={data.sessions}
  allDateSessions={[]}
  instructors={data.instructors}
  participantsByEnrollment={data.participantsByEnrollment}
  sessionOwnerType={data.sessionOwnerType}
/>
```

---

## Task 8: Three-mode `BookingDetailCard.svelte`

**Files:**
- Modify: `src/lib/modules/sessions/BookingDetailCard.svelte`

- [ ] **Step 1: Add `sessionOwnerType` prop**

In the `$props()` destructure, add:

```ts
let {
  booking,
  modules,
  sessions,
  allDateSessions,  // may be empty — only used for ownerType='booking' link flow
  instructors,
  participantsByEnrollment,
  sessionOwnerType   // NEW: 'booking' | 'service' | 'edition' | null
}: {
  ...existing types...
  sessionOwnerType: 'booking' | 'service' | 'edition' | null;
} = $props();
```

- [ ] **Step 2: Wrap existing CRUD UI with `{#if sessionOwnerType === 'booking'}` guard**

The entire existing session add/edit/bulk-generate UI should be wrapped:

```svelte
{#if sessionOwnerType === 'booking' || sessionOwnerType === null}
  <!-- ... existing full CRUD UI ... -->
{:else if sessionOwnerType === 'service'}
  <!-- service enrollment mode — step 3 below -->
{:else if sessionOwnerType === 'edition'}
  <!-- edition read-only mode — step 4 below -->
{/if}
```

- [ ] **Step 3: Add service enrollment mode UI**

```svelte
{:else if sessionOwnerType === 'service'}
  <div class="rounded-(--radius-card) ring-1 ring-border overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-surface">
      <h3 class="font-semibold text-sm text-gray-800">Sesión asignada</h3>
      <a href="/services/{booking.serviceId}/sessions/" class="text-xs text-ocean hover:underline">
        Gestionar sesiones →
      </a>
    </div>

    {#if sessions.length === 0}
      <!-- Unassigned state -->
      <div class="px-4 py-6 text-center">
        <p class="text-sm text-muted mb-3">Sin sesión asignada</p>
        <form method="POST" action="?/assignToSession" use:enhance>
          <select name="sessionId" class="input-base text-sm mb-2 w-full" required>
            <option value="">Selecciona una sesión...</option>
            {#each allDateSessions as s}
              <option value={s.id}>{s.time ?? 'Sin hora'} — {s.status}</option>
            {/each}
          </select>
          <button type="submit" class="btn-primary btn-sm w-full">Asignar</button>
        </form>
      </div>
    {:else}
      <!-- Assigned state — show the session -->
      {@const assigned = sessions[0]}
      <div class="px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">{assigned.date} {assigned.time ? `· ${assigned.time.slice(0,5)}` : ''}</p>
          <p class="text-xs text-muted capitalize">{assigned.status}</p>
        </div>
        <form method="POST" action="?/unassignFromSession" use:enhance>
          <button type="submit" class="text-xs text-red-500 hover:underline">Desasignar</button>
        </form>
      </div>
    {/if}
  </div>
```

- [ ] **Step 4: Add edition read-only mode UI**

```svelte
{:else if sessionOwnerType === 'edition'}
  <div class="rounded-(--radius-card) ring-1 ring-border overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-surface">
      <h3 class="font-semibold text-sm text-gray-800">Programa del campamento</h3>
      <a href="/services/{booking.serviceId}/roster?run={booking.serviceEditionId}" class="text-xs text-ocean hover:underline">
        Gestionar programa →
      </a>
    </div>

    {#if sessions.length === 0}
      <p class="px-4 py-6 text-center text-sm text-muted">Sin sesiones programadas aún</p>
    {:else}
      <div class="divide-y divide-border">
        {#each sessions as s}
          <div class="px-4 py-2 flex items-center gap-3">
            <span class="text-xs text-muted w-20 shrink-0">{s.date}</span>
            <span class="text-sm">{s.time ? s.time.slice(0,5) : '—'}</span>
            <span class="text-xs capitalize text-muted">{s.status}</span>
            {#if s.participants.length > 0}
              <span class="text-xs text-muted ml-auto">{s.participants.length} participantes</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
```

- [ ] **Step 5: Verify no TS errors in component**

```bash
npx tsc --noEmit 2>&1 | grep "BookingDetailCard"
```

---

## Task 9: New route — `/services/[id]/sessions/`

**Files:**
- Create: `src/routes/(app)/services/[id]/sessions/+page.server.ts`
- Create: `src/routes/(app)/services/[id]/sessions/+page.svelte`

- [ ] **Step 1: Create `+page.server.ts`**

```ts
import { error, fail } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import {
  listSessionsForService,
  listUnassignedEnrollments,
  assignBookingToSession,
  createSession,
  updateSession,
  cancelSession,
  deleteSession,
  bulkGenerateSessionsForEdition
} from '$lib/features/sessions/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { requireRole } from '$lib/server/permissions';
import type { Actions, PageServerLoad } from './$types';
import type { BulkGenOptions } from '$lib/features/sessions/types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  requireRole(locals, 'admin', 'owner', 'manager');
  const service = await getService(params.id);
  if (!service) error(404, 'Service not found');

  // Guard: must have sessions+roster modules but NOT editions
  const m = service.modules ?? {};
  if (!('sessions' in m) || !('roster' in m) || 'editions' in m) {
    error(404, 'Sessions page not available for this service type');
  }

  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;

  const [sessions, instructors] = await Promise.all([
    listSessionsForService(params.id, from, to),
    listInstructors()
  ]);

  // Unassigned enrollments per date (sessions exist but bookings not assigned)
  const sessionDates = [...new Set(sessions.map(s => s.date))];
  const unassignedByDate: Record<string, Awaited<ReturnType<typeof listUnassignedEnrollments>>> = {};
  await Promise.all(
    sessionDates.map(async date => {
      const u = await listUnassignedEnrollments(params.id, date);
      if (u.length > 0) unassignedByDate[date] = u;
    })
  );

  return { service, sessions, instructors, unassignedByDate };
};

export const actions: Actions = {
  addSession: async ({ request, params, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const date = form.get('date')?.toString();
    if (!date) return fail(400, { error: 'date required' });
    await createSession({
      ownerType: 'service',
      serviceId: params.id,
      date,
      time: form.get('time')?.toString() || undefined,
      durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
      instructorIds: form.getAll('instructorId').map(String).filter(Boolean),
      notes: form.get('notes')?.toString() || undefined
    });
    return { error: null, message: 'Sesión añadida' };
  },

  updateSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const id = form.get('sessionId')?.toString() ?? '';
    if (!id) return fail(400, { error: 'sessionId required' });
    await updateSession(id, {
      date: form.get('date')?.toString() || undefined,
      time: form.get('time')?.toString() || null,
      durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : null,
      notes: form.get('notes')?.toString() || null,
      instructorIds: form.getAll('instructorId').map(String).filter(Boolean)
    });
    return { error: null, message: 'Sesión actualizada' };
  },

  cancelSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const id = form.get('sessionId')?.toString() ?? '';
    if (!id) return fail(400, { error: 'sessionId required' });
    await cancelSession(id);
    return { error: null, message: 'Sesión cancelada' };
  },

  deleteSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const id = form.get('sessionId')?.toString() ?? '';
    if (!id) return fail(400, { error: 'sessionId required' });
    await deleteSession(id);
    return { error: null, message: 'Sesión eliminada' };
  },

  assignBookingToSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const bookingId = form.get('bookingId')?.toString() ?? '';
    const sessionId = form.get('sessionId')?.toString() ?? '';
    if (!bookingId || !sessionId) return fail(400, { error: 'bookingId and sessionId required' });
    try {
      await assignBookingToSession(bookingId, sessionId);
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { error: null, message: 'Cliente asignado a sesión' };
  }
};
```

- [ ] **Step 2: Create `+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  // Sessions grouped by date
  const sessionsByDate = $derived(() => {
    const map: Record<string, typeof data.sessions> = {};
    for (const s of data.sessions) (map[s.date] ??= []).push(s);
    return map;
  });

  const sortedDates = $derived(Object.keys(sessionsByDate()).sort());
  const totalUnassigned = $derived(
    Object.values(data.unassignedByDate).reduce((acc, list) => acc + list.length, 0)
  );
</script>

<div class="p-4 md:p-6">
  <div class="mb-6 flex items-center gap-3">
    <a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">
      ← {data.service.name}
    </a>
    <h1 class="text-xl font-bold text-navy">Sesiones</h1>
  </div>

  {#if totalUnassigned > 0}
    <div class="mb-4 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3 flex items-center justify-between">
      <p class="text-sm text-amber-800">
        ⚠ {totalUnassigned} inscripción{totalUnassigned > 1 ? 'es' : ''} sin asignar a sesión
      </p>
    </div>
  {/if}

  <!-- Add session form -->
  <details class="mb-6">
    <summary class="cursor-pointer text-sm font-medium text-ocean">+ Añadir sesión</summary>
    <form method="POST" action="?/addSession" use:enhance class="mt-3 rounded-lg bg-surface ring-1 ring-border p-4 grid grid-cols-2 gap-3">
      <div class="col-span-2 sm:col-span-1">
        <label class="label-base">Fecha</label>
        <input name="date" type="date" class="input-base" required />
      </div>
      <div>
        <label class="label-base">Hora</label>
        <input name="time" type="time" class="input-base" />
      </div>
      <div>
        <label class="label-base">Duración (min)</label>
        <input name="durationMinutes" type="number" class="input-base" placeholder="90" />
      </div>
      <div class="col-span-2">
        <label class="label-base">Monitor</label>
        <select name="instructorId" class="input-base">
          <option value="">Sin asignar</option>
          {#each data.instructors as i}
            <option value={i.id}>{i.name}</option>
          {/each}
        </select>
      </div>
      <div class="col-span-2">
        <button type="submit" class="btn-primary btn-sm">Crear sesión</button>
      </div>
    </form>
  </details>

  {#if data.sessions.length === 0}
    <p class="py-8 text-center text-sm text-muted">Sin sesiones. Crea la primera arriba.</p>
  {:else}
    {#each sortedDates as date}
      {@const daySessions = sessionsByDate()[date]}
      {@const unassigned = data.unassignedByDate[date] ?? []}
      <div class="mb-6">
        <h2 class="mb-2 text-sm font-semibold text-gray-600">{date}</h2>

        {#if unassigned.length > 0}
          <div class="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {unassigned.length} cliente{unassigned.length > 1 ? 's' : ''} sin asignar
            {#each unassigned as u}
              <div class="mt-1 flex items-center gap-2">
                <span>{u.firstName} {u.lastName}</span>
                <form method="POST" action="?/assignBookingToSession" use:enhance class="flex gap-1 flex-wrap">
                  <input type="hidden" name="bookingId" value={u.bookingId} />
                  {#each daySessions.filter(s => s.status !== 'cancelled') as s}
                    <button name="sessionId" value={s.id} class="rounded px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-xs">
                      Asignar a {s.time?.slice(0,5) ?? 'sin hora'}
                    </button>
                  {/each}
                </form>
              </div>
            {/each}
          </div>
        {/if}

        <div class="divide-y divide-border rounded-(--radius-card) ring-1 ring-border overflow-hidden">
          {#each daySessions as s}
            {@const statusClass = s.status === 'cancelled' ? 'bg-red-50' : s.status === 'completed' ? 'bg-green-50' : 'bg-surface'}
            <div class="px-4 py-3 {statusClass}">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <span class="font-medium text-sm">{s.time?.slice(0,5) ?? '—'}</span>
                  {#if s.durationMinutes}
                    <span class="text-xs text-muted ml-1">· {s.durationMinutes} min</span>
                  {/if}
                  {#if s.instructors.length}
                    <span class="text-xs text-muted ml-1">· {s.instructors.map(i => i.instructorName).join(', ')}</span>
                  {/if}
                </div>
                <div class="flex gap-2 items-center">
                  <span class="text-xs capitalize text-muted">{s.status}</span>
                  {#if s.status !== 'cancelled'}
                    <form method="POST" action="?/cancelSession" use:enhance>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button type="submit" class="text-xs text-red-500 hover:underline">Cancelar</button>
                    </form>
                  {/if}
                  <form method="POST" action="?/deleteSession" use:enhance>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button type="submit" class="text-xs text-red-600 hover:underline">Eliminar</button>
                  </form>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>
```

---

## Task 10: Roster route — edition sessions section

**Files:**
- Modify: `src/routes/(app)/services/[id]/roster/+page.server.ts`
- Modify: `src/routes/(app)/services/[id]/roster/+page.svelte`

- [ ] **Step 1: Update `+page.server.ts` load to fetch edition sessions**

Add import:

```ts
import {
  listSessionsForEdition,
  createSession,
  updateSession,
  cancelSession,
  deleteSession,
  bulkGenerateSessionsForEdition
} from '$lib/features/sessions/queries';
import { recalcEditionBookingAmounts } from '$lib/features/bookings/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { Actions } from './$types';
```

In the `load` function, after loading bookings, add:

```ts
const [sessionsByEdition, instructors] = await Promise.all([
  (async () => {
    const map: Record<string, Awaited<ReturnType<typeof listSessionsForEdition>>> = {};
    await Promise.all(
      editions.map(async e => {
        map[e.id] = await listSessionsForEdition(e.id);
      })
    );
    return map;
  })(),
  listInstructors()
]);

return { service, editions, focusEditionId, bookingsByEdition, sessionsByEdition, instructors };
```

- [ ] **Step 2: Add edition session actions**

```ts
export const actions: Actions = {
  addEditionSession: async ({ request, params, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form = await request.formData();
    const editionId = form.get('editionId')?.toString() ?? '';
    const date      = form.get('date')?.toString() ?? '';
    if (!editionId || !date) return fail(400, { error: 'editionId and date required' });
    await createSession({
      ownerType: 'edition', editionId, date,
      time: form.get('time')?.toString() || undefined,
      durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
      instructorIds: form.getAll('instructorId').map(String).filter(Boolean)
    });
    await recalcEditionBookingAmounts(editionId);
    return { error: null, message: 'Sesión añadida' };
  },

  updateEditionSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form      = await request.formData();
    const sessionId = form.get('sessionId')?.toString() ?? '';
    const editionId = form.get('editionId')?.toString() ?? '';
    if (!sessionId) return fail(400, { error: 'sessionId required' });
    await updateSession(sessionId, {
      date: form.get('date')?.toString() || undefined,
      time: form.get('time')?.toString() || null,
      durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : null,
      notes: form.get('notes')?.toString() || null,
      instructorIds: form.getAll('instructorId').map(String).filter(Boolean)
    });
    if (editionId) await recalcEditionBookingAmounts(editionId);
    return { error: null, message: 'Sesión actualizada' };
  },

  cancelEditionSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form      = await request.formData();
    const sessionId = form.get('sessionId')?.toString() ?? '';
    const editionId = form.get('editionId')?.toString() ?? '';
    if (!sessionId) return fail(400, { error: 'sessionId required' });
    await cancelSession(sessionId);
    if (editionId) await recalcEditionBookingAmounts(editionId);
    return { error: null, message: 'Sesión cancelada' };
  },

  deleteEditionSession: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form      = await request.formData();
    const sessionId = form.get('sessionId')?.toString() ?? '';
    const editionId = form.get('editionId')?.toString() ?? '';
    if (!sessionId) return fail(400, { error: 'sessionId required' });
    await deleteSession(sessionId);
    if (editionId) await recalcEditionBookingAmounts(editionId);
    return { error: null, message: 'Sesión eliminada' };
  },

  bulkGenerateEditionSessions: async ({ request, locals }) => {
    requireRole(locals, 'admin', 'owner', 'manager');
    const form      = await request.formData();
    const editionId = form.get('editionId')?.toString() ?? '';
    const startDate = form.get('startDate')?.toString() ?? '';
    const endDate   = form.get('endDate')?.toString() ?? '';
    if (!editionId || !startDate || !endDate) return fail(400, { error: 'Missing required fields' });

    const opts: BulkGenOptions = {
      sessionsPerDay: parseInt(form.get('sessionsPerDay')?.toString() ?? '1'),
      times: form.getAll('sessionTime').map(t => t.toString() || undefined),
      weekdaysOnly: form.get('weekdaysOnly') === 'true',
      durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
      clearExisting: form.get('clearExisting') === 'true'
    };
    await bulkGenerateSessionsForEdition(editionId, { startDate, endDate }, opts);
    await recalcEditionBookingAmounts(editionId);
    return { error: null, message: 'Sesiones generadas' };
  }
};
```

Add missing import at top: `import type { BulkGenOptions } from '$lib/features/sessions/types';`

- [ ] **Step 3: Add sessions section to `+page.svelte` (below roster table, per edition tab)**

After the `{#if activeBookings.length === 0}...{/if}` roster block, add:

```svelte
<!-- Sessions section for this edition -->
{@const editionSessions = data.sessionsByEdition[activeEditionId] ?? []}
<div class="mt-6">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-sm font-semibold text-gray-700">Programa</h2>
    <details>
      <summary class="cursor-pointer text-xs text-ocean">+ Añadir sesión</summary>
      <form method="POST" action="?/addEditionSession" use:enhance class="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-surface ring-1 ring-border p-3">
        <input type="hidden" name="editionId" value={activeEditionId} />
        <div>
          <label class="label-base text-xs">Fecha</label>
          <input name="date" type="date" class="input-base" required
            min={activeEdition?.startDate} max={activeEdition?.endDate} />
        </div>
        <div>
          <label class="label-base text-xs">Hora</label>
          <input name="time" type="time" class="input-base" />
        </div>
        <div>
          <label class="label-base text-xs">Duración (min)</label>
          <input name="durationMinutes" type="number" class="input-base" placeholder="90" />
        </div>
        <div>
          <label class="label-base text-xs">Monitor</label>
          <select name="instructorId" class="input-base">
            <option value="">—</option>
            {#each data.instructors as i}
              <option value={i.id}>{i.name}</option>
            {/each}
          </select>
        </div>
        <div class="col-span-2">
          <button type="submit" class="btn-primary btn-sm">Crear</button>
        </div>
      </form>
    </details>
  </div>

  {#if editionSessions.length === 0}
    <p class="text-center py-4 text-sm text-muted">Sin sesiones programadas</p>
  {:else}
    <div class="divide-y divide-border rounded-(--radius-card) ring-1 ring-border overflow-hidden">
      {#each editionSessions as s}
        <div class="px-4 py-2 flex items-center gap-3 {s.status === 'cancelled' ? 'opacity-50' : ''}">
          <span class="text-xs w-24 shrink-0">{s.date}</span>
          <span class="text-sm">{s.time?.slice(0,5) ?? '—'}</span>
          {#if s.instructors.length > 0}
            <span class="text-xs text-muted">{s.instructors[0].instructorName}</span>
          {/if}
          <span class="text-xs capitalize text-muted ml-auto">{s.status}</span>
          {#if s.status !== 'cancelled'}
            <form method="POST" action="?/cancelEditionSession" use:enhance>
              <input type="hidden" name="sessionId" value={s.id} />
              <input type="hidden" name="editionId" value={activeEditionId} />
              <button type="submit" class="text-xs text-red-500 hover:underline">Cancelar</button>
            </form>
          {/if}
          <form method="POST" action="?/deleteEditionSession" use:enhance>
            <input type="hidden" name="sessionId" value={s.id} />
            <input type="hidden" name="editionId" value={activeEditionId} />
            <button type="submit" class="text-xs text-red-600 hover:underline">Eliminar</button>
          </form>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

---

## Task 11: Service detail — sessions nav link

**Files:**
- Modify: `src/routes/(app)/services/[id]/+page.server.ts`
- Modify: `src/routes/(app)/services/[id]/+page.svelte`

- [ ] **Step 1: Expose `hasGroupSessions` flag from server**

In `+page.server.ts` load return, add:

```ts
const m = service.modules ?? {};
const hasGroupSessions = 'sessions' in m && 'roster' in m && !('editions' in m);

return {
  ...,  // existing fields
  hasGroupSessions
};
```

- [ ] **Step 2: Add sessions link to `+page.svelte`**

After the existing roster quick link block:

```svelte
{#if data.hasGroupSessions}
  <a href="/services/{data.service.id}/sessions/"
    class="btn-primary btn-block mb-4 text-center block">
    Ver sesiones de grupo →
  </a>
{/if}
```

---

## Task 12: Calendar + Agenda updates

**Files:**
- Modify: `src/routes/(app)/calendar/+page.svelte`
- Modify: `src/routes/(app)/agenda/+page.svelte` (if file exists)

The server files (`calendar/+page.server.ts`, `agenda/+page.server.ts`) import `listSessionsForDate` and `listSessionsForDateRange` by name — those names are preserved, so no server-side import changes needed.

- [ ] **Step 1: Update `calendar/+page.svelte` — fix `SessionCard` props**

Search the calendar Svelte file for any reference to `session.bookingId` (the old non-null field) and replace with `session.primaryBookingId`.

Find the `SessionCard` component or wherever sessions are rendered in day view. Update link generation:

```svelte
<!-- Old: -->
href="/bookings/{session.bookingId}"

<!-- New (import sessionDetailLink at top of script): -->
import { sessionDetailLink } from '$lib/features/sessions/queries';
...
href={sessionDetailLink(session)}
```

- [ ] **Step 2: Update `agenda/+page.svelte` — same fixes**

Same replacements: `session.bookingId` → `session.primaryBookingId`, and use `sessionDetailLink(session)` for routing.

- [ ] **Step 3: Check `SessionCard.svelte` or inline card component**

Search for any calendar card component that references `bookingId` from a session:

```bash
grep -r "session\.bookingId\|\.bookingId" src/lib/components/calendar/ src/lib/components/sessions/ 2>/dev/null
```

For each hit, update to `session.primaryBookingId`.

- [ ] **Step 4: Full build check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Start dev server + smoke test**

```bash
npm run dev
```

Manually test:
1. Open a private lesson booking → sessions card shows full CRUD (unchanged)
2. Open a group class booking → sessions card shows "Sin sesión asignada" or assigned session
3. Open a camp booking → sessions card shows edition schedule read-only
4. `/services/[camp-id]/roster` → sessions section appears per edition tab
5. `/services/[group-class-id]/sessions/` → loads, shows session list
6. Calendar day view → sessions appear, clicking routes correctly

- [ ] **Step 6: Commit Phase 1 + Phase 2**

```bash
git add \
  drizzle/0039_session_ownership.sql \
  src/lib/server/db/schema.ts \
  src/lib/features/sessions/types.ts \
  src/lib/features/sessions/queries.ts \
  src/lib/features/bookings/types.ts \
  src/lib/features/bookings/queries.ts \
  src/routes/\(app\)/bookings/\[id\]/+page.server.ts \
  src/routes/\(app\)/bookings/\[id\]/+page.svelte \
  src/lib/modules/sessions/BookingDetailCard.svelte \
  src/routes/\(app\)/services/\[id\]/sessions/ \
  src/routes/\(app\)/services/\[id\]/roster/+page.server.ts \
  src/routes/\(app\)/services/\[id\]/roster/+page.svelte \
  src/routes/\(app\)/services/\[id\]/+page.server.ts \
  src/routes/\(app\)/services/\[id\]/+page.svelte \
  src/routes/\(app\)/calendar/+page.svelte \
  src/routes/\(app\)/agenda/+page.svelte

git commit -m "feat: session ownership refactor — explicit owner_type + booking.session_id enrollment"
```

---

## Phase 3 (future — separate migration, ~2 weeks after stable)

```sql
-- After confirming Phase 2 is stable and booking_sessions has no new writes:
DROP TABLE booking_sessions;
```

Create as `drizzle/0040_drop_booking_sessions.sql` when ready. Also remove `bookingSessions` from `schema.ts` and all imports in `sessions/queries.ts` old code.

---

## Post-implementation verification checklist

- [ ] Private lesson booking: sessions card shows full CRUD, `ownerType='booking'`
- [ ] Group class booking: sessions card shows assign/unassign, links to `/services/[id]/sessions/`
- [ ] Camp booking: sessions card shows edition schedule read-only, links to `/roster?run=...`
- [ ] Calendar day view: all three session types appear with correct service name/color
- [ ] Calendar day view: clicking a session routes to correct detail page
- [ ] Agenda view: same routing works
- [ ] `/services/[id]/sessions/`: loads, add/cancel/delete work, unassigned banner appears when applicable
- [ ] `/services/[id]/roster`: sessions section visible per edition tab, add/cancel/delete work
- [ ] Creating an edition session auto-syncs participants to `session_participants`
- [ ] Cancelling an edition session triggers `recalcEditionBookingAmounts`
- [ ] DB: `SELECT COUNT(*) FROM sessions WHERE owner_type IS NULL` = 0
- [ ] DB: `booking_sessions` table still exists (Phase 3 not yet done — that's intentional)
