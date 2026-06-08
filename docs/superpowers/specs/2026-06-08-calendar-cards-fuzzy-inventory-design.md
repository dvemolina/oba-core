# Design Spec: Calendar Rich Cards + Fuzzy Inventory + Button Fix
Date: 2026-06-08

## Scope

Three independent features from TODO.md:
1. **#5** — Fix button label in new booking form
2. **#1** — Calendar rich session cards (month + week views) with hover/tap popover
3. **#3** — Fuzzy inventory assignment (reserve item type without specifying variant)

Out of scope: booking flow architecture redesign (dedicated session), service-inventory UX redesign (dedicated session).

---

## TODO #5 — Button Label Fix

**Change:** In `/bookings/new`, find i18n key or hardcoded string "reservar alojamiento" and replace with "crear reserva".

**Files:** `src/routes/(app)/bookings/new/+page.svelte` + relevant i18n message file.

Simple text change. No logic, no component.

---

## TODO #1 — Calendar Rich Session Cards

### Goal

Replace dot indicators and flat booking bars in month/week views with rich cards. Shared component, two size variants. Hover popover on desktop, tap popover on touch.

### Components

**`src/lib/components/ui/Popover.svelte`** — Generic reusable popover.
- Props: `open: boolean`, `anchor: HTMLElement | null`, `onclose: () => void`
- Positions itself relative to anchor element, auto-flips if near viewport edge
- Closes on click-outside and Escape key
- Used here and available for future use anywhere in the app

**`src/lib/components/calendar/SessionCardInfo.svelte`** — Shared info sub-component.
- Props: `booking: BookingSummary` (or compatible session shape)
- Renders: service name, client(s), participant count, payment status badge
- Used by `SessionCard` (popover) AND by the existing day view session blocks (card header)
- DRY: one source of truth for what "booking info" looks like

**`src/lib/components/calendar/SessionCard.svelte`** — Navigable card for month + week views only.
- Props: `booking: BookingSummary`, `size: 'compact' | 'medium'`, `date: string`
- `compact` (month view): colored pill — `HH:MM · Service Name`, truncated
- `medium` (week view): colored card — `HH:MM`, service name, `firstClientName` (+ `+N` if `clientCount > 1`)
- Manages its own hover/touch state internally
- Desktop `(hover: hover)`: `mouseenter` → show Popover, `mouseleave` (150ms grace) → hide, `click` → `goto(/bookings/[id])`
- Touch `(hover: none)`: `click` → toggle Popover, outside click → close
- Popover uses `SessionCardInfo` + two action buttons:
  - "Ver reserva" → `goto(/bookings/[id])`
  - "Ver día" → `goto(/calendar?view=day&date={date})`

**Day view cards** — NOT replaced. Already have inline scheduling form, instructor conflict detection, assignment logic — complexity beyond a simple card. Day view extracts `SessionCardInfo` for its header section only.

### Info shown per view

| View | Content |
|------|---------|
| Month (compact) | service color + HH:MM + service name (truncated) |
| Week (medium) | HH:MM + service name + first client + participant count |
| Day (existing) | service + participants + instructors + payment + inline form |
| Popover (all) | full SessionCardInfo + "Ver reserva" + "Ver día" buttons |

### Data

`BookingSummary` already includes `firstClientName`, `clientCount`, `serviceColor`, `serviceName`, `time`, `status`. No query changes needed.

Price is not in `BookingSummary` — omit from medium card for now (add in architecture session when pricing model is stabilized).

### Calendar Integration

- **Month view** (`+page.svelte`): replace dot rendering loop with `<SessionCard size="compact" {booking} />`
- **Week view** (`+page.svelte`): replace booking bar rendering with `<SessionCard size="medium" {booking} />`
- Day view unchanged (already has rich session chips)

### File Structure

```
src/lib/components/
  ui/
    Popover.svelte          ← new
  calendar/
    SessionCard.svelte      ← new
```

---

## TODO #3 — Fuzzy Inventory Assignment

### Goal

Allow creating a booking with "I need 1 wetsuit + 1 board" without specifying exact item/variant. System warns if stock will be insufficient. Operator assigns specific items when client arrives.

### Schema

**No migration needed.** `inventory_allocations.itemId` is already nullable. A row with `itemId = null` = fuzzy/unassigned allocation. A row with `itemId != null` = confirmed allocation.

Existing `allocationStatusEnum` values (`allocated`, `returned`, `damaged`, `lost`) remain unchanged. `itemId IS NULL` is the fuzzy indicator — no new column needed.

### Availability Logic

New file: `src/lib/features/inventory/availability.ts`

```ts
// Returns available qty for a given itemTypeId on a given date range
// available = totalStock - allocations where status = 'allocated' AND date overlaps
// Works for both fuzzy (itemId null) and confirmed (itemId set) allocations
getAvailability(itemTypeId, startDate, endDate): Promise<{
  total: number,
  confirmed: number,   // itemId IS NOT NULL
  pending: number,     // itemId IS NULL
  available: number    // total - confirmed - pending
}>
```

Reused across all 4 warning surfaces.

### UI Surfaces

**1. `/bookings/new` — Create fuzzy allocation**
- When service has inventory: "Equipamiento necesario" section
- Add item type (dropdown from linked item types) + quantity
- `itemId` not required — creates fuzzy allocation
- Inline warning if `available < requested` for booking dates

**2. `/bookings/[id]` — Assign specific item**
- Fuzzy allocations (itemId null) show chip: `⚠ [ItemType] ×N — Pendiente de asignar`
- Chip has "Asignar" button → opens modal with available items/variants selector
- On assign: PATCH allocation, set `itemId`, status stays `allocated`

**3. `/inventory/[id]` — Availability timeline**
- New section "Ocupación" on item type detail page
- Table/list: next 14 days, each row: date | confirmed | pending | available
- Color coding: green (available > 0), amber (pending > 0 but available >= 0), red (available < 0)

**4. `/calendar/[date]` — Day view shortage badge**
- If any item type has `available < 0` on that day: warning badge in day header
- Badge: `⚠ Inventario insuficiente` → links to inventory page

### New File: `src/lib/components/inventory/AllocationBadge.svelte`
- Reusable chip for pending/confirmed allocations
- Props: `status: 'pending' | 'confirmed'`, `itemTypeName: string`, `qty: number`, `onAssign?: () => void`
- Used in `/bookings/[id]` and anywhere else allocations are displayed

### API

Extend existing inventory allocation API or add actions in `+page.server.ts`:
- `POST /api/v1/bookings/[id]/allocations` — create allocation (itemId optional)
- `PATCH /api/v1/bookings/[id]/allocations/[allocId]` — assign itemId to fuzzy allocation

---

## Tomorrow's Architecture Session — Context

Separate dedicated session for:
- Full modular system design (service capabilities → booking form modules)
- Domain modeling for surf school + generalizable outdoor business
- UX flows for every service type
- TODO #2 + TODO #4 from TODO.md

See `docs/superpowers/specs/2026-06-09-architecture-session-brief.md` for session kickoff prompt.
