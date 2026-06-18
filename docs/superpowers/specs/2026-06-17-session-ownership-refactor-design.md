# Session Ownership Refactor — Design Spec

**Date:** 2026-06-17  
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

## Decision: Approach B — Explicit owner column + check constraint

Sessions get a `owner_type` enum column (`booking | service | edition`) plus three nullable FK
columns (`booking_id`, `service_id`, `service_edition_id`). A DB check constraint enforces that
exactly one FK is non-null. `booking_sessions` junction is retired for private/edition sessions
and survives only as a group-class enrollment table.

**Why not the alternatives:**
- Option A (additive nullable FKs, no enforcement): implicit ownership, no DB guarantee
- Option C (auto-share by magic): ambiguous ownership, cascade bugs, two models coexist forever

---

## Session ownership model

| Service modules | `owner_type` | Owner FK | Creation point |
|---|---|---|---|
| `sessions` only | `booking` | `booking_id` | Booking detail page (unchanged) |
| `sessions` + `roster` (no editions) | `service` | `service_id` | `/services/[id]/sessions/` or calendar |
| `sessions` + `editions` + `roster` | `edition` | `service_edition_id` | Roster page per edition tab |

**CRUD permissions:** `admin`, `owner`, `manager` have full CRUD on all session types regardless
of `owner_type`. Ownership determines where in the UI sessions are created and displayed,
not who can touch them. `owner_type` is immutable after creation.

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

### `session_participants` — unique constraint fix

Two clients named "María" in the same camp session currently violates `UNIQUE(session_id, name)`.

```sql
DROP INDEX uq_session_participants_session_name;

-- Booking-linked: one slot per booking_participant per session
CREATE UNIQUE INDEX uq_session_participants_bp
  ON session_participants(session_id, booking_participant_id)
  WHERE booking_participant_id IS NOT NULL;

-- Manual (ad-hoc) participants: no uniqueness — name is display-only
```

`addParticipant` conflict target updated to `(session_id, booking_participant_id)`.

### `booking_participants` — cleanup

```sql
ALTER TABLE booking_participants DROP COLUMN IF EXISTS booking_id_temp;
```

### `booking_sessions` — phased removal

Kept through Phase 2. In Phase 3, rows for `ownerType IN ('booking', 'edition')` are deleted
(redundant — ownership now in FK). Rows for `ownerType = 'service'` are kept (group class
enrollment). Table itself deferred to future single-dispatch cleanup refactor.

### `bookings.sessionsIncluded` — semantic change

For `ownerType='edition'` bookings, `sessionsIncluded` is ignored by `recalcBookingAmounts`.
Live count of non-cancelled edition sessions is used instead. Column retained for private lessons.

---

## Section 2: Query Layer

### Single dispatch — `resolveSessionContext`

```ts
// sessions/queries.ts — the only function that inspects service modules for sessions

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

`listSessionsForContext` replaces every direct `listSessionsForBooking` call at the page/action
level. `listSessionsForBooking` becomes an internal function.

### Ownership-specific queries

```ts
// Private — direct FK query, no junction
async function listSessionsForBooking(bookingId: string): Promise<Session[]>

// Group class — sessions for a service on a date
async function listSessionsForServiceOnDate(serviceId: string, date: string): Promise<Session[]>

// Group class — full schedule (service sessions page)
export async function listSessionsForService(serviceId: string, from?: string, to?: string): Promise<Session[]>

// Camp — all edition sessions
export async function listSessionsForEdition(editionId: string): Promise<Session[]>
```

### `createSession` — discriminated union input

```ts
export type CreateSessionInput =
  | ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
  | ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
  | ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)
```

For `ownerType='edition'`: `createSession` auto-calls `syncParticipantsToEditionSession` after
insert. All enrolled participants from all edition bookings are synced idempotently.

### Delete functions

```ts
deleteSessionsForBooking(bookingId)      // DELETE WHERE booking_id = ? AND owner_type = 'booking'
deleteSessionsForEdition(editionId)      // DELETE WHERE service_edition_id = ?
deleteSessionsForServiceOnDate(serviceId, date)  // DELETE WHERE service_id = ? AND date = ?
```

All rely on DB cascade for `session_instructors` and `session_participants`. No manual cleanup.

### Bulk generate — shared date-slot builder

```ts
export async function bulkGenerateSessionsForBooking(bookingId, booking, opts): Promise<void>
export async function bulkGenerateSessionsForEdition(editionId, edition, opts): Promise<void>

// Both call:
function buildDateSlots(start, end, opts): DateSlot[]
```

`buildDateSlots` is the single implementation. Zero duplication between the two generators.

### Calendar queries — cross-owner enrichment

`listSessionsForDate` and `listSessionsForDateRange` now query all sessions on a date regardless
of `owner_type`, then route enrichment through three paths:

```ts
async function enrichSessionsForCalendar(rows): Promise<SessionForDay[]> {
  const byType = groupBy(rows, r => r.ownerType);
  const [booking, service, edition] = await Promise.all([
    enrichBookingOwnedSessions(byType.booking ?? []),
    enrichServiceOwnedSessions(byType.service ?? []),
    enrichEditionOwnedSessions(byType.edition ?? []),
  ]);
  return [...booking, ...service, ...edition].sort(bySortOrderThenTime);
}
```

Each enricher pulls service name/color + enrolled clients + payment totals via its own join path.

### `recalcBookingAmounts` — edition-aware

```ts
// For edition bookings: use live session count from DB, not booking.sessionsIncluded
if (booking.serviceEditionId && 'editions' in modules) {
  effectiveSessions = await countNonCancelledEditionSessions(booking.serviceEditionId);
}

// Fan-out: recalc all bookings in edition after any session change
export async function recalcEditionBookingAmounts(editionId: string): Promise<void>
```

### Participant sync — automatic and idempotent

```ts
// Called on: new edition session created
export async function syncParticipantsToEditionSession(sessionId, editionId): Promise<void>

// Fan-out: called on booking joins edition, participant added/removed, count changed
export async function syncAllParticipantsToEditionSessions(editionId): Promise<void>
```

Uses `onConflictDoNothing` on `(session_id, booking_participant_id)` — safe to call multiple
times. When a booking client is cancelled from an edition, their `session_participants` rows
are removed from all edition sessions.

---

## Section 3: UI / Routes

### Route map

| Route | Change |
|---|---|
| `/bookings/[id]` | Load uses `listSessionsForContext`; session card adapts to `ownerType` |
| `/services/[id]` | Adds "Sessions" link for `sessions+roster` (no editions) services |
| `/services/[id]/sessions/` | **New route** — group class session management |
| `/services/[id]/roster/` | Gains session management section per edition tab |
| `/calendar/[date]`, `/agenda` | Updated `SessionForDay` type; card routing via `sessionDetailLink` |

### Session card on booking detail — three modes

```
ownerType='booking'  → full CRUD (current behavior, unchanged)
ownerType='service'  → read-only list for booking's date + enroll/unenroll actions
                       "Manage sessions →" link to /services/[id]/sessions/
ownerType='edition'  → read-only full edition schedule + all participants
                       "Manage schedule →" link to /services/[id]/roster?run=[editionId]
```

### Guards on booking detail actions

Every session action on `/bookings/[id]` guards `ownerType` before executing:
- `addSession`, `bulkGenerateSessions` → only `ownerType='booking'`
- `linkToSession`, `unlinkFromSession` → only `ownerType='service'`
- `cancelSession`, `deleteSession` → if `ownerType='edition'`: calls `recalcEditionBookingAmounts`
- `addBookingParticipant`, `setParticipantCount`, `syncParticipantsToSessions` → if `ownerType='edition'`: calls edition fan-out sync

### New route: `/services/[id]/sessions/`

Group class session management page. Mirrors roster page structure.

Actions: `addSession`, `updateSession`, `cancelSession`, `deleteSession`, `bulkGenerate`.
All create sessions with `{ ownerType: 'service', serviceId }`.
No `recalc` needed for group class sessions (pricing not session-count driven for roster services
without sessions module per-person pricing).

### Roster page additions

Each edition tab gains a **Sessions** section below the bookings list.

New actions on roster page: `addEditionSession`, `updateEditionSession`, `cancelEditionSession`,
`deleteEditionSession`, `bulkGenerateEditionSessions`. All call `recalcEditionBookingAmounts`
after mutations.

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

### Phase 1 — Schema (before code deploy, single transaction)

1. Create `session_owner_type` enum
2. Add nullable columns to `sessions`
3. Add indexes
4. Detect + delete orphaned sessions (no `booking_sessions` link) — logged before delete
5. Smart backfill: classify each session by its booking's service modules
   - `editions` module + `serviceEditionId` set → `ownerType='edition'`
   - `roster` module, no `editions` → `ownerType='service'`
   - everything else → `ownerType='booking'`
   - Multi-booking sessions: earliest `booking_sessions.created_at` wins as primary owner
6. Verify: abort if any session unclassified
7. `ALTER COLUMN owner_type SET NOT NULL`
8. Add `chk_session_owner` check constraint
9. Fix `session_participants` unique constraint
10. Drop `booking_participants.booking_id_temp`

### Phase 2 — Code deploy (immediately after Phase 1)

New code reads ownership from new columns. `booking_sessions` kept but not written for
private/edition sessions. Group class enrollment still reads/writes `booking_sessions`.

Existing camp sessions are now `ownerType='edition'` → visible from all edition bookings
on the roster page immediately. Old per-booking camp sessions gone from booking detail
(correct — they now live on the roster).

### Phase 3 — Cleanup (~2 weeks after stable)

```sql
DELETE FROM booking_sessions bs
WHERE EXISTS (
  SELECT 1 FROM sessions s
  WHERE s.id = bs.session_id
  AND s.owner_type IN ('booking', 'edition')
);
```

Full `booking_sessions` table drop deferred to future single-dispatch refactor.

### Rollback

- Phase 1 fails → transaction rolls back, DB unchanged
- Phase 1 committed, Phase 2 not deployed → additive columns, old code ignores them, reads `booking_sessions` as before
- Phase 2 deployed, issues → revert code deploy; schema stays (non-breaking)
- Phase 3 ran → recoverable from backup; sessions intact via new FKs

### Post-migration verification

```sql
SELECT COUNT(*) FROM sessions WHERE owner_type IS NULL;             -- expect 0
SELECT owner_type, COUNT(*) FROM sessions GROUP BY owner_type;      -- expect all 3 types
SELECT COUNT(*) FROM sessions WHERE owner_type IN ('service','edition') AND booking_id IS NOT NULL; -- expect 0
SELECT COUNT(*) FROM session_participants;                          -- compare to pre-migration count
```

---

## Section 5: Type Contracts

### `sessions/types.ts` key types

```ts
export type SessionOwnerType = 'booking' | 'service' | 'edition';

export type SessionContext =
  | { type: 'booking'; bookingId: string }
  | { type: 'service'; serviceId: string; date: string }
  | { type: 'edition'; editionId: string }

// Minimal booking shape for dispatch — full Booking satisfies this structurally
export interface BookingSessionContext {
  id: string;
  date: string;
  serviceId: string | null;
  serviceEditionId: string | null;
  serviceModules: ServiceModules;
}

export interface Session {
  // ... existing fields ...
  ownerType: SessionOwnerType;
  bookingId: string | null;
  serviceId: string | null;
  serviceEditionId: string | null;
}

// SessionForDay: bookingId: string → primaryBookingId: string | null
// AgendaSession: same change + add ownerType, editionId
```

### `CreateSessionInput` — discriminated union

```ts
export type CreateSessionInput =
  | ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
  | ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
  | ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)
```

TypeScript compiler enforces correct owner fields at every call site.

### Type guards

```ts
export const isBookingSession  = (s: Session): s is Session & { bookingId: string }         => s.ownerType === 'booking';
export const isServiceSession  = (s: Session): s is Session & { serviceId: string }         => s.ownerType === 'service';
export const isEditionSession  = (s: Session): s is Session & { serviceEditionId: string }  => s.ownerType === 'edition';
```

### `SESSION_COLS` constant

All queries use a shared `SESSION_COLS` selector object. Adding/removing a column requires
one edit, not six.

---

## Files changed (complete list)

### Schema
- `src/lib/server/db/schema.ts` — add enum, new columns, update `session_participants` index

### Migrations
- `drizzle/migrations/XXXX_session_ownership.sql` — full Phase 1 migration with backfill

### Feature: sessions
- `src/lib/features/sessions/types.ts` — full replacement per Section 5
- `src/lib/features/sessions/queries.ts` — new dispatch, per-owner queries, updated calendar enrichment, new bulk gen, new participant sync, updated delete functions

### Feature: bookings
- `src/lib/features/bookings/queries.ts` — `recalcBookingAmounts` edition-aware + `recalcEditionBookingAmounts`

### Routes
- `src/routes/(app)/bookings/[id]/+page.server.ts` — `listSessionsForContext`, guards on actions, edition fan-out triggers
- `src/routes/(app)/bookings/[id]/+page.svelte` — pass `sessionOwnerType` to sessions card
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

### Modules (UI components)
- `src/lib/modules/sessions/BookingDetailCard.svelte` — three-mode rendering

### Utilities
- Session detail link helper (inline in calendar components or shared util)

---

## What this enables for white-label SaaS

Every tenant's service follows the same module-driven ownership rules. A yoga studio's
"Tuesday Flow" class uses `ownerType='service'`. A climbing gym's "Beginner Course April"
uses `ownerType='edition'`. A personal trainer's session uses `ownerType='booking'`.
No per-tenant logic. No magic. The module system drives behaviour uniformly.

---

## Out of scope (tracked in `docs/future-refactor-single-dispatch.md`)

- Full single-dispatch refactor of `activeModuleKeys` inspection across all UI components
- `bookingSessions` table full removal (requires group class to migrate off junction)
- `bookings.sessionsIncluded` deprecation for edition services
- `bookings.time` + `isFlexible` cleanup for non-private bookings
