# Module System Design — OBA Core
Date: 2026-06-13
Status: Approved for implementation

## Overview

OBA Core uses a **Module System** — an ECS-inspired (Entity-Component-System) architecture where services are defined by composing capability modules. No business logic is hardcoded to service types. All behavior emerges from which modules are active on a service.

**Governing principle:** `if (service.modules.X)` — never `if (service.type === 'Y')`.

This makes the platform composable for any outdoor activity business without code changes. An owner builds their own service catalog by mixing modules through a UI — effectively configuring the app's behavior without touching code.

---

## Core Concepts

### Entities
- **Service** — defines a product/offer. Has modules + pricing config.
- **Booking** — a scheduled instance of a service for one or more clients.
- **Enrollment** (`bookingClients`) — one client's participation in a booking. Has participant count, payment, optional credit source.
- **Participant** (`bookingParticipants`) — named individual doing the activity. Belongs to an enrollment.
- **Session** — a discrete scheduled activity (date, time, duration, attendance).
- **Edition** (`serviceEditions`) — a pre-defined dated instance of a service (e.g. "Surf Camp Jul 13–18").

### Vocabulary
- **Client** = who formalizes and pays. Forms the CRM database. Always 1+ per booking.
- **Participant** = who physically does the activity. Scoped per enrollment. 1+ per enrollment.
- **Attendee** = participant who attended a specific session.
- **Credit** = pre-paid session entitlement from a pack purchase.

---

## The 6 Modules

### `sessions`
Enables scheduled activities with date, time, duration, and per-participant attendance.

**Service config:**
```typescript
sessions: {
  durationMinutes?: number   // default session duration
  defaultCount?: number      // pre-fill session count (e.g. 5 for a camp)
}
```

**Booking gains:** list of Session records linked via `bookingSessions`. Each session tracks attendees from across all enrollments.

**Logic:**
- Instructor conflict detection (if `instructor` also active)
- Attendance tracking per participant per session
- Calendar: sessions appear as time-grid events on their date

---

### `roster`
Enables multiple independent client enrollments on the same booking slot.

**Service config:**
```typescript
roster: {
  maxCapacity: number   // total participants across all enrollments
}
```

**Booking gains:** multiple `bookingClients` records on the same booking. Capacity enforced as `SUM(enrollment.participantCount) ≤ maxCapacity`.

**Logic:**
- Remaining spots shown in real time
- Warning (not hard block) when slot is full — manager can override
- Inventory needs = SUM of all enrollment participant counts

---

### `editions`
Enables pre-defined dated instances of a service. Manager creates editions upfront; clients enroll into them.

**Service config:**
```typescript
editions: {}   // presence activates the module; no config needed here
```

**Booking gains:** `serviceEditionId` FK — which edition the client enrolled in. `booking.date` / `booking.dateEnd` auto-filled from edition. Date input hidden at booking creation.

**Logic:**
- Edition appears on calendar as multi-day block even with 0 enrollments
- Each edition has its own `maxCapacity` (overrides service-level roster capacity)
- Booking date is derived from edition, not free input

---

### `inventory`
Enables physical item assignment per participant. Fuzzy first (reserve quantity), specific at arrival (assign exact item).

**Service config:**
```typescript
inventory: {
  perParticipant: true
  // linked item types defined in serviceInventoryLinks table
  // each link: itemTypeId, quantityPerParticipant
}
```

**Booking gains:** `inventoryAllocations` per participant slot. Status: `allocated` (fuzzy) → updated with specific `itemId` + attributes at arrival.

**Logic:**
- Auto-calculates needs from total participant count across all enrollments
- Only shows item types linked to THIS service (not full catalog)
- Inventory shortage badge on calendar day header when pool insufficient
- Accommodation uses this module: rooms/beds are inventory items

---

### `instructor`
Enables instructor assignment to booking or individual sessions.

**Service config:**
```typescript
instructor: {
  required: boolean
  // default instructors defined in serviceInstructors table
}
```

**Booking gains:** `bookingInstructors` records. If `sessions` also active: `sessionInstructors` per session.

**Logic:**
- If `required: true` → warning if no instructor assigned
- Schedule conflict detection: warning if instructor has overlapping session

---

### `credits`
Enables pre-paid credit packs. Purchase = flat price = N session credits consumed over time.

**Service config:**
```typescript
credits: {
  creditsIncluded: number                      // e.g. 5
  validityMode: 'season' | 'days'
  validityDays?: number                         // if validityMode === 'days'
  compatibleServiceIds: string[]               // which services can consume credits from this pack
}
```

**Booking behavior (pack purchase):**
- One booking record = the purchase contract
- `booking.date` = purchase date
- Does NOT appear on calendar (it's a transaction, not a scheduled event)
- Credits remaining = `creditsIncluded - SUM(creditCount from enrollments using this pack)`

**Enrollment with credits:**
```typescript
bookingClients: {
  creditSourceId: string | null    // FK to pack purchase booking
  creditCount: number              // how many credits this enrollment consumes
  // amountDue = (participantCount - creditCount) × basePrice
}
```

Supports **partial credit**: client brings 3 participants, 1 has a pack. `creditCount=1`, `amountDue = 2 × basePrice`.

**UI:** compact badge `🎟 2 restantes ↗` next to client name. Link navigates to pack booking detail. In payment section: `🎟 crédito` instead of amount for credited portion.

---

## Service Composition Table

| Service | Active modules |
|---|---|
| Clase grupal | `roster` `sessions` `inventory` `instructor` |
| Clase privada | `sessions` `inventory` `instructor` |
| Bono 5x grupales | `credits` |
| Bono 5x privadas | `credits` |
| Alquiler tabla/neopreno | `inventory` |
| Habitación doble | `inventory` |
| Casa completa | `inventory` |
| Surf Camp | `roster` `editions` `sessions` `inventory` `instructor` |
| Collab trip | `roster` `editions` `sessions` `instructor` |

No `if (service.type === 'camp')` anywhere in the codebase.

---

## Data Model Changes

### `services` table
```sql
-- Remove columns:
has_sessions BOOLEAN
has_roster BOOLEAN
has_date_range BOOLEAN
has_inventory_units BOOLEAN
requires_instructor BOOLEAN

-- Add column:
modules JSONB NOT NULL DEFAULT '{}'
```

TypeScript type:
```typescript
type ServiceModules = {
  sessions?:   { durationMinutes?: number; defaultCount?: number }
  roster?:     { maxCapacity: number }
  editions?:   {}
  inventory?:  { perParticipant: true }
  instructor?: { required: boolean }
  credits?:    { creditsIncluded: number; validityMode: 'season' | 'days'; validityDays?: number; compatibleServiceIds: string[] }
}
```

### `service_editions` table (rename from `service_runs`)
No schema change — rename only. `serviceRunId` on bookings becomes `serviceEditionId`.

### `bookings` table

```sql
-- Remove column (moves to booking_clients):
participant_count INTEGER
```

### `booking_clients` table
```sql
-- Add columns:
participant_count INTEGER NOT NULL DEFAULT 1
credit_source_id TEXT REFERENCES bookings(id)
credit_count INTEGER NOT NULL DEFAULT 0
```

### `booking_participants` table
```sql
-- Change FK:
booking_id TEXT  →  booking_client_id TEXT REFERENCES booking_clients(id)
```

Participants belong to an enrollment, not the booking. This enables correct per-enrollment pricing and per-client participant lists.

---

## Pricing Engine

Pure function — no service type checks:

```typescript
function calculateAmountDue(
  service: Service,
  enrollment: BookingClient,
  context: { sessionCount: number; days: number }
): number {
  const billableParticipants = enrollment.participantCount - enrollment.creditCount
  const base = service.basePrice

  switch (service.pricingMode) {
    case 'flat':                   return base
    case 'per_person':             return base * billableParticipants
    case 'per_session':            return base * context.sessionCount
    case 'per_person_per_session': return base * billableParticipants * context.sessionCount
    case 'per_unit':               return base
    case 'per_day':                return base * context.days
    case 'per_unit_per_day':       return base * billableParticipants * context.days
    case 'per_night':              return base * context.days
  }
}
```

Credits covered portion = `enrollment.creditCount × basePrice` — deducted from total, charged to pack.

---

## Cross-Module Concerns

### Availability check
`checkAvailability(serviceId, date, participantCount)` returns warnings from each active module:
- `roster`: remaining spots = `maxCapacity - SUM(enrollments.participantCount on this slot)`
- `editions`: edition capacity check
- `inventory`: pool availability for date range

Warnings shown to manager — not hard blocks (manager can override).

### Conflict detection
- **Instructor conflict**: `instructor` + `sessions` — same instructor, overlapping session times
- **Inventory shortage**: `inventory` + `roster` — total participants on date exceeds pool size

### Calendar rendering
| What | Condition | How |
|---|---|---|
| Booking chip | always | On `booking.date` |
| Session event | `sessions` module | Time-grid on session date |
| Edition block | `editions` module | Multi-day block, shows even with 0 enrollments |
| Pack purchase | `credits` service | Not shown on calendar |
| Inventory shortage | `inventory` module | Badge on day header |

---

## UX Flows

### Service creation
1. **Identity** — name (free text), label (cosmetic tag, no logic), color
2. **Modules** — toggle list with icon + one-line description per module. Active modules show config fields inline.
3. **Pricing** — mode auto-suggested based on active modules; base price; manual override allowed.

### Booking creation
Single `<NewBooking>` component. Sections injected by active modules:
1. Base: date (or edition picker if `editions`), client search/create
2. `roster` → participant count for this enrollment + remaining capacity
3. `sessions` → first session time/duration
4. `instructor` → instructor picker
5. `inventory` → auto-calculated equipment needs (read-only at create time)
6. `credits` → if client has compatible pack with balance → option to apply credits
7. Pricing summary — always at bottom, auto-calculated

### Booking detail
One card per active module:
- **Grupos** (`roster`): enrolled clients with participant counts, payment status, credit badges, add client action
- **Sesiones** (`sessions`): session list with attendance, add session action
- **Instructor** (`instructor`): assigned instructor, change action
- **Inventario** (`inventory`): equipment needs per participant, assign action
- **Pago**: always last. Per-enrollment breakdown. Credit enrollments show `🎟 crédito` + cash remainder.

---

## Code Structure

```
src/lib/modules/
  sessions/
    logic.ts            # calculations, conflict detection, availability
    ServiceConfig.svelte # config UI in service creation
    BookingCreate.svelte # section in new booking form
    BookingDetail.svelte # section in booking detail view
  roster/    ...
  editions/  ...
  inventory/ ...
  instructor/...
  credits/   ...
  index.ts              # module registry: maps key → components + logic
```

Booking form composition:
```svelte
{#each activeModules(service) as module}
  <svelte:component this={module.BookingCreate} {booking} {service} />
{/each}
```

No `if/else` chains based on service type anywhere.

---

## Out of Scope (this iteration)

- `bundle` module — package deals combining multiple services
- Instructor login / instructor-facing views
- Client portal
- WhatsApp/email reminders
- Multi-tenancy tenant scoping
