# Future Refactor: Single Dispatch Philosophy

## The Principle

Every piece of logic that currently branches on service type or module presence should live
in ONE dispatch function/utility. Callers should never inspect `service.modules` directly
to decide which code path to take.

## Current violations (as of 2026-06-17)

### 1. `listSessionsForBooking` called everywhere with no context awareness
Every page that shows sessions on a booking calls this directly. After the session-ownership
refactor, this still needs one unified entry point:
```ts
listSessionsForContext(booking) // routes to booking | service | edition sessions
```
Files to update: `booking/[id]/+page.server.ts`, `sessions/queries.ts`, `participants.queries.ts`

### 2. `recalcBookingAmounts` is per-booking but edition services affect N bookings
Should become:
```ts
recalcForContext(bookingId | editionId) // fan-out to all edition bookings if needed
```
File: `bookings/queries.ts`

### 3. `bulkGenerateSessions` is booking-scoped
Should be:
```ts
bulkGenerateForBooking(bookingId, options)   // private lessons
bulkGenerateForEdition(editionId, options)   // camps
```

### 4. `activeModuleKeys` in modules.ts drives UI rendering
Currently used inline in Svelte components to conditionally render cards.
Should be centralized into a `serviceContext(service)` object that returns
capability flags: `{ hasSharedSessions, hasRoster, hasEditions, hasCredits, ... }`.
Components consume the flags, never inspect modules directly.

### 5. Pricing `calculateAmount` branches on pricingMode
Already fairly clean. But `defaultPricingModeForModules` should be the ONLY place
that maps modules → pricing mode. No inline `if (modules.sessions && modules.roster)`
scattered in route files.

### 6. Participant sync (`syncParticipantsToSessions`)
Currently booking-scoped. Should be:
```ts
syncParticipantsForContext(bookingId) // routes to edition-wide or booking-scoped sync
```

### 7. Booking detail page conditionally shows/hides action cards based on modules
Currently done with `#if 'sessions' in booking.serviceModules` etc. in Svelte.
Should use a single `bookingCapabilities` object from the server load, never
raw module inspection in templates.

## How to use this doc

Paste into a new conversation with:
> "I want to refactor OBA Core around the single-dispatch philosophy described in
> docs/future-refactor-single-dispatch.md. Here's the current state of the codebase..."

Then attach relevant file contents.

## Design constraint

Every new feature built before this refactor should at minimum NOT ADD NEW MODULE INSPECTION
at the call site. New code should call the dispatch functions above (once they exist),
or note a TODO pointing to this doc.
