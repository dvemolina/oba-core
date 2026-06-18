# Session Ownership Refactor — Design Spec

**Date:** 2026-06-17  
**Updated:** 2026-06-18  
**Status:** Approved for implementation  
**Branch target:** main  

---

## Problem

Sessions are always created inside a booking and linked via the `booking_sessions` junction table.
For group services (camps, collabs, group classes), multiple clients each have their own booking.
A session created from booking A is invisible to booking B even when both clients attend the same
camp day or group class. The root cause: session ownership is scoped to a booking, but for shared
services it should be scoped to the service schedule (edition or service).

---

## Decision: Approach B + industry-standard enrollment model

Sessions get an `owner_type` enum column (`booking | service | edition`) plus three nullable FK
columns (`booking_id`, `service_id`, `service_edition_id`). A DB check constraint enforces that
exactly one FK is non-null.

For group class enrollment, `bookings.session_id` (nullable FK) replaces the `booking_sessions`
junction table entirely. This is the industry-standard model used by Mindbody, Glofox, and ClassPass:
booking = commercial transaction, session = operational occurrence, `booking.session_id` = enrollment.

`booking_sessions` table: fully dropped in Phase 3. No rows survive.

**Why not the alternatives:**

- Option A (additive nullable FKs, no enforcement): implicit ownership, no DB guarantee
- Option C (auto-share by magic): ambiguous ownership, cascade bugs, two models coexist forever
- Junction table for enrollment: non-standard, adds indirection where a direct FK is correct

---

## Core distinction: commercial enrollment vs. operational attendance

These are different concepts, tracked in different tables:

| Concept | Table | Meaning |
| --- | --- | --- |
| Commercial enrollment | `bookings.session_id` | Which session this booking's client will attend. Drives payment, scheduling. Nullable (TBD). |
| Operational attendance | `session_participants` | Who was physically present in a session. Unrestricted — anyone, with or without a booking. |

A group class client whose booking is assigned to session A can also appear as a `session_participant`
in a camp session (staff adds them ad-hoc). The booking is not re-enrolled — the participant record
is independent. This handles cross-service attendance without polluting the commercial enrollment model.

---

## Session ownership model

| Service modules | `owner_type` | Session FK | Enrollment | Creation point |
| --- | --- | --- | --- | --- |
| `sessions` only | `booking` | `sessions.booking_id` | Implicit (1:1) | Booking detail (unchanged) |
| `sessions` + `roster` (no editions) | `service` | `sessions.service_id` | `bookings.session_id` nullable | `/services/[id]/sessions/` or calendar |
| `sessions` + `editions` + `roster` | `edition` | `sessions.service_edition_id` | `bookings.service_edition_id` (existing) | Roster page per edition tab |

**CRUD permissions:** `admin`, `owner`, `manager` have full CRUD on all session types. `owner_type`
determines where sessions are created and displayed, not who can touch them. `owner_type` is
immutable after creation. `bookings.session_id` is mutable (client can be reassigned between sessions).

---

## Section 1: Schema

### `sessions` table — new columns

```sql
CREATE TYPE session_owner_type AS ENUM ('booking', 'service', 'edition');

ALTER TABLE sessions
  ADD COLUMN owner_type         session_owner_type NOT NULL,  -- enforced after backfill
  ADD COLUMN booking_id         text REFERENCES bookings(id) ON DELETE CASCADE,
  ADD COLUMN service_id         text REFERENCES services(id) ON DELETE CASCADE,
  ADD COLUMN service_edition_id text REFERENCES service_editions(id) ON DELETE CASCADE;

ALTER TABLE sessions ADD CONSTRAINT chk_session_owner CHECK (
  (owner_type = 'booking' AND booking_id IS NOT NULL
    AND service_id IS NULL AND service_edition_id IS NULL)
  OR
  (owner_type = 'service' AND service_id IS NOT NULL
    AND booking_id IS NULL AND service_edition_id IS NULL)
  OR
  (owner_type = 'edition' AND service_edition_id IS NOT NULL
    AND booking_id IS NULL AND service_id IS NULL)
);

CREATE INDEX idx_sessions_booking_id          ON sessions(booking_id);
CREATE INDEX idx_sessions_service_id          ON sessions(service_id);
CREATE INDEX idx_sessions_service_edition_id  ON sessions(service_edition_id);
```

**Cascade correctness:**

- `booking_id` CASCADE DELETE → private lesson deleted with its booking ✓
- `service_id` CASCADE DELETE → group class sessions deleted with service ✓
- `service_edition_id` CASCADE DELETE → camp sessions deleted with edition ✓
- `serviceEditions` already cascades from `services` → transitively safe ✓
- `sessionInstructors` + `sessionParticipants` already CASCADE from `sessions.id` ✓

### `bookings` table — group class enrollment FK

```sql
ALTER TABLE bookings
  ADD COLUMN session_id text REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_session_id ON bookings(session_id);
```

`ON DELETE SET NULL` → deleting a session reverts its enrolled bookings to unassigned (null).
Bookings are never lost, they just need re-assignment.

Nullable by design — a booking for a group class may be created before the session schedule exists.
This is the "TBD" state: client has purchased, time not yet assigned.

**App-level guard:** `bookings.session_id` must reference a session where `session.service_id = booking.service_id`.
Enforced in `assignBookingToSession` — not a DB constraint (would be circular) but validated before every write.

### `session_participants` — unique constraint fix

Two clients named "María" in the same camp session currently violates `UNIQUE(session_id, name)`.

```sql
DROP INDEX uq_session_participants_session_name;

CREATE UNIQUE INDEX uq_session_participants_bp
  ON session_participants(session_id, booking_participant_id)
  WHERE booking_participant_id IS NOT NULL;
-- Ad-hoc participants (bookingParticipantId IS NULL): no uniqueness — name is display-only
```

`addParticipant` conflict target updated to `(session_id, booking_participant_id)`.

### `booking_participants` — cleanup

```sql
ALTER TABLE booking_participants DROP COLUMN IF EXISTS booking_id_temp;
```

### `booking_sessions` — fully dropped in Phase 3

No rows survive Phase 3. Private/edition rows removed (ownership now in session FKs). Group class
rows removed (enrollment now in `bookings.session_id`).

```sql
-- Phase 3
DROP TABLE booking_sessions;
```

### `bookings.sessionsIncluded` — semantic change

For `ownerType='edition'` bookings, `sessionsIncluded` is ignored by `recalcBookingAmounts`.
Live count of non-cancelled edition sessions is used instead. Column retained for private lessons.

---

## Section 2: Query Layer

### Single dispatch — `resolveSessionContext`

```ts
// sessions/queries.ts — the ONLY function that inspects service modules for sessions

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
    case 'booking': return listSessionsForBooking(ctx.bookingId);
    case 'service': return listSessionsForServiceOnDate(ctx.serviceId, ctx.date);
    case 'edition': return listSessionsForEdition(ctx.editionId);
  }
}
```

### Ownership-specific queries

```ts
// Private — direct FK, no junction
async function listSessionsForBooking(bookingId: string): Promise<Session[]>

// Group class — sessions for a service on a date
async function listSessionsForServiceOnDate(serviceId: string, date: string): Promise<Session[]>

// Group class — full schedule (service sessions page)
export async function listSessionsForService(serviceId: string, from?: string, to?: string): Promise<Session[]>

// Camp — all edition sessions
export async function listSessionsForEdition(editionId: string): Promise<Session[]>
```

### Group class enrollment queries

```ts
// Which bookings are enrolled in this group class session?
// Direct FK join — no junction table
export async function listEnrollmentsForSession(sessionId: string): Promise<BookingEnrollment[]> {
  return db.select({
    bookingId: bookings.id,
    clientId:  bookingClients.clientId,
    firstName: clients.firstName,
    lastName:  clients.lastName,
    amountDue: bookingClients.amountDue,
    amountPaid: bookingClients.amountPaid,
    status:    bookingClients.status
  })
  .from(bookings)
  .innerJoin(bookingClients, eq(bookingClients.bookingId, bookings.id))
  .innerJoin(clients, eq(bookingClients.clientId, clients.id))
  .where(and(eq(bookings.sessionId, sessionId), ne(bookings.status, 'cancelled')));
}

// Unassigned enrollments for a service on a date (bookings with session_id = null)
export async function listUnassignedEnrollments(serviceId: string, date: string) {
  return db.select(...)
    .from(bookings)
    .innerJoin(bookingClients, ...)
    .where(and(
      eq(bookings.serviceId, serviceId),
      eq(bookings.date, date),
      isNull(bookings.sessionId),
      ne(bookings.status, 'cancelled')
    ));
}

// Assign booking to session — with service match guard
export async function assignBookingToSession(bookingId: string, sessionId: string | null): Promise<void> {
  if (sessionId !== null) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!session || session.ownerType !== 'service' || session.serviceId !== booking?.serviceId)
      throw new Error('Session does not belong to this booking\'s service');
  }
  await db.update(bookings).set({ sessionId }).where(eq(bookings.id, bookingId));
}
```

### `createSession` — discriminated union input

```ts
export type CreateSessionInput =
  | ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
  | ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
  | ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)
```

For `ownerType='edition'`: `createSession` auto-calls `syncParticipantsToEditionSession`.
For `ownerType='service'`: no auto-sync — enrollment is via `bookings.session_id` assignment.

### Delete functions

```ts
deleteSessionsForBooking(bookingId)             // DELETE WHERE booking_id = ? AND owner_type = 'booking'
deleteSessionsForEdition(editionId)             // DELETE WHERE service_edition_id = ?
deleteSessionsForServiceOnDate(serviceId, date) // DELETE WHERE service_id = ? AND date = ?
```

`ON DELETE SET NULL` on `bookings.session_id` handles group class session deletion automatically —
enrolled bookings revert to unassigned without any application code.

### Bulk generate — shared date-slot builder

```ts
export async function bulkGenerateSessionsForBooking(bookingId, booking, opts): Promise<void>
export async function bulkGenerateSessionsForEdition(editionId, edition, opts): Promise<void>

function buildDateSlots(start: string, end: string, opts: BulkGenOptions): DateSlot[]
// Single implementation, zero duplication
```

### Calendar queries — cross-owner enrichment

```ts
async function enrichSessionsForCalendar(rows: RawSession[]): Promise<SessionForDay[]> {
  const byType = groupBy(rows, r => r.ownerType);
  const [booking, service, edition] = await Promise.all([
    enrichBookingOwnedSessions(byType.booking ?? []),
    enrichServiceOwnedSessions(byType.service ?? []),  // uses listEnrollmentsForSession per session
    enrichEditionOwnedSessions(byType.edition ?? []),
  ]);
  return [...booking, ...service, ...edition].sort(bySortOrderThenTime);
}
```

`enrichServiceOwnedSessions`: queries enrolled bookings via `bookings WHERE session_id = ?` —
no junction join. Simpler than the previous `booking_sessions` approach.

### `recalcBookingAmounts` — edition-aware + fan-out

```ts
// Edition bookings: live session count replaces booking.sessionsIncluded
if (booking.serviceEditionId && 'editions' in modules) {
  effectiveSessions = await countNonCancelledEditionSessions(booking.serviceEditionId);
}

// Fan-out after any edition session change
export async function recalcEditionBookingAmounts(editionId: string): Promise<void>
```

### Participant sync — automatic and idempotent

```ts
// Called on: new edition session created
export async function syncParticipantsToEditionSession(sessionId: string, editionId: string): Promise<void>

// Fan-out: called on booking joins edition, participant added/removed, count changed
export async function syncAllParticipantsToEditionSessions(editionId: string): Promise<void>
```

Triggers:

| Event | Sync call |
| --- | --- |
| New edition session created | `syncParticipantsToEditionSession(newId, editionId)` |
| Booking added to edition | `syncAllParticipantsToEditionSessions(editionId)` |
| `addBookingParticipant` on edition booking | `syncAllParticipantsToEditionSessions(editionId)` |
| `setParticipantCount` on edition booking | `syncAllParticipantsToEditionSessions(editionId)` |
| Booking client cancelled from edition | Remove their `session_participants` rows across all edition sessions |

---

## Section 3: UI / Routes

### Route map

| Route | Change |
| --- | --- |
| `/bookings/[id]` | Load uses `listSessionsForContext`; session card adapts to `ownerType`; group class shows assigned session + reassign CTA |
| `/services/[id]` | Adds "Sessions" link for `sessions+roster` (no editions) services |
| `/services/[id]/sessions/` | **New route** — group class session management + unassigned enrollment banner |
| `/services/[id]/roster/` | Gains session management section per edition tab |
| `/calendar/[date]`, `/agenda` | Updated `SessionForDay` type; card routing via `sessionDetailLink` |

### Session card on booking detail — three modes

```text
ownerType='booking'  → full CRUD (current behavior, unchanged)

ownerType='service'  → shows assigned session (or "Not yet assigned" state)
                       "Assign to session" dropdown (existing sessions for service+date, inline create)
                       "Reassign" action if already assigned
                       "Manage sessions →" link to /services/[id]/sessions/

ownerType='edition'  → read-only full edition schedule + all participants
                       "Manage schedule →" link to /services/[id]/roster?run=[editionId]
```

### Guards on booking detail actions

Every session action guards `ownerType` before executing:

- `addSession`, `bulkGenerateSessions` → only `ownerType='booking'`
- `assignToSession`, `unassignFromSession` → only `ownerType='service'`
- `cancelSession`, `deleteSession` → if `ownerType='edition'`: calls `recalcEditionBookingAmounts`
- `addBookingParticipant`, `setParticipantCount`, `syncParticipantsToSessions` → if `ownerType='edition'`: edition fan-out

### New route: `/services/[id]/sessions/`

Group class session management. Mirrors roster page structure.

```text
[Service name]  →  Sessions

⚠ 3 unassigned enrollments on Jun 25          ← banner when listUnassignedEnrollments > 0
  [View unassigned]

[Add session]  [Bulk generate]

Jun 25
  10:00 · 90 min · Ana  · 4 enrolled   [Edit] [Cancel]
    ↳ Enrolled: Client A, Client B, Client C, Client D
  14:00 · 90 min · Pedro · 2 enrolled  [Edit] [Cancel]
    ↳ Enrolled: Client E, Client F

Jun 26
  ...
```

Unassigned enrollment modal: lists bookings with `session_id = null` for that service+date.
Staff drags/selects to assign each to a session. Single action: `assignBookingToSession`.

Actions: `addSession`, `updateSession`, `cancelSession`, `deleteSession`, `bulkGenerate`,
`assignBookingToSession`.

### Roster page — edition sessions section

Each edition tab gains a **Sessions** section below the bookings list.
New actions: `addEditionSession`, `updateEditionSession`, `cancelEditionSession`,
`deleteEditionSession`, `bulkGenerateEditionSessions`. All call `recalcEditionBookingAmounts`.

### Calendar routing

```ts
export function sessionDetailLink(session: SessionForDay | AgendaSession): string {
  switch (session.ownerType) {
    case 'booking': return `/bookings/${session.primaryBookingId}`;
    case 'service': return `/services/${session.serviceId}/sessions/`;
    case 'edition': return `/services/${session.serviceId}/roster?run=${session.editionId}`;
  }
}
```

---

## Section 4: Migration Plan

### Phase 1 — Schema (single transaction, before code deploy)

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

-- 5. Detect + log orphaned sessions (no booking_sessions link)
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
-- Each group class booking gets the session it was linked to via booking_sessions
UPDATE bookings b
SET session_id = bs.session_id
FROM booking_sessions bs
JOIN sessions s ON s.id = bs.session_id
WHERE bs.booking_id = b.id
  AND s.owner_type = 'service';
-- Note: if a booking had multiple booking_sessions links (rare), latest wins (DISTINCT ON ordering).
-- Unlinked group class bookings keep session_id = NULL (unassigned — correct).

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
  (owner_type = 'booking' AND booking_id IS NOT NULL AND service_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'service' AND service_id IS NOT NULL AND booking_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'edition' AND service_edition_id IS NOT NULL AND booking_id IS NULL AND service_id IS NULL)
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

### Production data classification (from modules snapshot)

| Service | Modules | Sessions → `owner_type` |
| --- | --- | --- |
| Clase Privada | `sessions` | `booking` |
| Clase grupal | `sessions` + `roster` | `service` |
| Tipiti Surf camp | `sessions` + `roster` + `editions` | `edition` |
| Helena Kazmier Collab | `sessions` + `roster` + `editions` | `edition` |
| Collab Rebelarte | `sessions` + `roster` + `editions` | `edition` |

Camp sessions previously per-booking are re-owned to their edition → visible from all edition
bookings on the roster page immediately after Phase 2 deploys.

### Phase 2 — Code deploy (immediately after Phase 1)

New code reads ownership from new columns. `booking_sessions` table kept but no new writes.
Group class enrollment reads from `bookings.session_id` — `booking_sessions` rows are dead.

### Phase 3 — Cleanup (~2 weeks after stable)

```sql
-- Remove all booking_sessions rows (all redundant — private/edition via session FKs, group via booking.session_id)
DROP TABLE booking_sessions;
```

### Rollback

| Phase | Rollback |
| --- | --- |
| Phase 1 fails | Transaction rolls back, DB unchanged |
| Phase 1 committed, Phase 2 not deployed | Additive columns; old code ignores them, reads `booking_sessions` |
| Phase 2 deployed, issues | Revert code deploy; schema stays (non-breaking) |
| Phase 3 ran | `booking_sessions` gone but all data preserved in new FKs |

### Post-migration verification

```sql
SELECT COUNT(*) FROM sessions WHERE owner_type IS NULL;                                   -- 0
SELECT owner_type, COUNT(*) FROM sessions GROUP BY owner_type;                            -- all 3 types
SELECT COUNT(*) FROM sessions WHERE owner_type IN ('service','edition') AND booking_id IS NOT NULL; -- 0
SELECT COUNT(*) FROM bookings WHERE session_id IS NOT NULL;                               -- group class assignments
SELECT COUNT(*) FROM session_participants;                                                 -- unchanged
SELECT indexname FROM pg_indexes WHERE tablename = 'session_participants';                -- uq_session_participants_bp present
```

---

## Section 5: Type Contracts

### `sessions/types.ts`

```ts
export type SessionOwnerType = 'booking' | 'service' | 'edition';
export type SessionStatus    = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';
export type SkillLevel       = 'beginner' | 'intermediate' | 'advanced';

export type SessionContext =
  | { type: 'booking'; bookingId: string }
  | { type: 'service'; serviceId: string; date: string }
  | { type: 'edition'; editionId: string }

// Minimal shape needed for dispatch — full Booking satisfies this structurally
export interface BookingSessionContext {
  id: string;
  date: string;
  serviceId: string | null;
  serviceEditionId: string | null;
  serviceModules: ServiceModules;
}

export interface Session {
  id: string;
  ownerType: SessionOwnerType;
  bookingId: string | null;          // set when ownerType='booking'
  serviceId: string | null;          // set when ownerType='service'
  serviceEditionId: string | null;   // set when ownerType='edition'
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

// Calendar enriched — bookingId: string → primaryBookingId: string | null
export interface SessionForDay extends Session {
  primaryBookingId: string | null;   // null for edition sessions
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

export type CreateSessionInput =
  | ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
  | ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
  | ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)

export interface BulkGenOptions {
  sessionsPerDay: number;
  times: (string | undefined)[];
  weekdaysOnly: boolean;
  durationMinutes?: number;
  clearExisting: boolean;
}
```

### Type guards

```ts
export const isBookingSession  = (s: Session): s is Session & { bookingId: string }        => s.ownerType === 'booking';
export const isServiceSession  = (s: Session): s is Session & { serviceId: string }        => s.ownerType === 'service';
export const isEditionSession  = (s: Session): s is Session & { serviceEditionId: string } => s.ownerType === 'edition';
```

### `SESSION_COLS` — shared column selector (DRY)

All queries select from a single `SESSION_COLS` const. One edit point when schema changes.

### Calendar routing helper

```ts
export function sessionDetailLink(session: Pick<SessionForDay, 'ownerType' | 'primaryBookingId' | 'serviceId' | 'editionId'>): string {
  switch (session.ownerType) {
    case 'booking': return `/bookings/${session.primaryBookingId}`;
    case 'service': return `/services/${session.serviceId}/sessions/`;
    case 'edition': return `/services/${session.serviceId}/roster?run=${session.editionId}`;
  }
}
```

### Breaking changes for TypeScript consumers

| Old | New | Impact |
| --- | --- | --- |
| `SessionForDay.bookingId: string` | `primaryBookingId: string or null` | Calendar + agenda card link |
| `CreateSessionInput.bookingId: string` | Discriminated union | All `createSession` call sites |
| `Session` (no owner fields) | `ownerType` + 3 nullable FKs | Any code that routes/renders sessions |
| `listSessionsForBooking` (public) | `listSessionsForContext` (public) | `booking/[id]/+page.server.ts` |

TypeScript compiler catches all at build time.

---

## Files changed (complete list)

### Schema + migrations

- `src/lib/server/db/schema.ts` — enum, new session columns, `bookings.session_id`, updated participant index
- `drizzle/migrations/XXXX_session_ownership.sql` — full Phase 1 migration with backfill

### Feature: sessions

- `src/lib/features/sessions/types.ts` — full replacement per Section 5
- `src/lib/features/sessions/queries.ts` — dispatch, per-owner queries, enrollment queries, calendar enrichment, bulk gen, participant sync, delete functions

### Feature: bookings

- `src/lib/features/bookings/queries.ts` — `recalcBookingAmounts` edition-aware, `recalcEditionBookingAmounts`, `assignBookingToSession`
- `src/lib/features/bookings/types.ts` — `sessionId` field on `Booking` type

### Routes

- `src/routes/(app)/bookings/[id]/+page.server.ts` — `listSessionsForContext`, action guards, assign/unassign actions
- `src/routes/(app)/bookings/[id]/+page.svelte` — pass `sessionOwnerType` to session card
- `src/routes/(app)/services/[id]/+page.server.ts` — sessions link for group-class services
- `src/routes/(app)/services/[id]/+page.svelte` — sessions nav link
- `src/routes/(app)/services/[id]/sessions/+page.server.ts` — **new**
- `src/routes/(app)/services/[id]/sessions/+page.svelte` — **new**
- `src/routes/(app)/services/[id]/roster/+page.server.ts` — edition session actions
- `src/routes/(app)/services/[id]/roster/+page.svelte` — sessions section per edition tab
- `src/routes/(app)/calendar/[date]/+page.server.ts` — updated `SessionForDay` consumption
- `src/routes/(app)/calendar/[date]/+page.svelte` — `sessionDetailLink` routing
- `src/routes/(app)/agenda/+page.server.ts` — updated `AgendaSession` consumption
- `src/routes/(app)/agenda/+page.svelte` — `sessionDetailLink` routing

### UI components

- `src/lib/modules/sessions/BookingDetailCard.svelte` — three-mode rendering (full CRUD / assign+view / read-only)

---

## What this enables for white-label SaaS

Every tenant's service follows module-driven ownership rules uniformly. A yoga studio's Tuesday Flow
class uses `ownerType='service'` with `bookings.session_id` enrollment. A climbing gym's Beginner
Course uses `ownerType='edition'`. A personal trainer's session uses `ownerType='booking'`.

No per-tenant logic. No junction tables. Every relationship is a direct FK. The module system
drives behaviour uniformly across all tenant types.

---

## Out of scope (tracked in `docs/future-refactor-single-dispatch.md`)

- Full single-dispatch refactor of `activeModuleKeys` inspection across all UI components
- `bookings.sessionsIncluded` deprecation for edition services
- `bookings.time` + `isFlexible` cleanup for non-private bookings
