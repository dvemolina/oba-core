# Architecture Session Brief — Modular Service/Booking System
Date: 2026-06-13 (scheduled)
Prepared: 2026-06-08

## Purpose

Design the core modular architecture of oba-core: how services define capabilities ("modules"), how booking creation adapts to those modules, and how each module's logic/UI is encapsulated and reused throughout the app.

This is the "vehicular" system of the app — everything else hangs off it.

## How to Start This Session

Open a new Claude Code conversation in this project and say:

> "Quiero hacer la sesión de arquitectura modular que planeamos. Lee el archivo docs/superpowers/specs/2026-06-09-architecture-session-brief.md y empieza desde ahí."

## Current State (as of 2026-06-08)

### What exists
- Services have "capability flags": `hasSessions`, `hasRoster`, `hasDateRange`, `hasInventoryUnits`, `requiresInstructor`, `pricingMode`
- Booking creation form (`/bookings/new/+page.svelte`) reads these flags and conditionally shows/hides sections
- Inventory module partially built: item types, items, variants, allocations
- Session module: sessions table, booking_sessions junction, duration override, conflict detection
- Participant module: booking_participants table, per-session attendee names
- Pricing: basePrice on service, pricingMode enum (`per_session`, `per_person`, `per_night`, `per_day`, `per_unit_per_day`, `per_person_per_day`)

### Known problems
- Booking form is a 200+ line monolith mixing all module logic
- Some fields belong at service level, appear at booking level (TODO #4)
- No formal "module" concept — flags exist but no encapsulation
- Fuzzy inventory UI being added (see today's spec) but inventory module not fully designed
- pricingMode on service → amountDue on booking: no per-client override, no discounts

### Service types in use
- Surf lesson (hasSessions + requiresInstructor)
- Surf camp (hasRoster + hasDateRange + hasSessions)
- Equipment rental (hasInventoryUnits + per_day/per_night pricing)
- Accommodation (hasInventoryUnits + per_night)
- (future) Shop product, package deals

## Session Goals

1. **Domain model audit** — map every entity and relationship, identify what's correct, what's wrong, what's missing
2. **Module definition** — formally define what a "module" is, which modules exist, what each owns (schema, UI, logic)
3. **Service creation flow** — which capabilities/modules are configured at service level
4. **Booking creation flow** — per-module UI, what's required vs optional, field ownership
5. **Booking detail view** — per-module sections, actions, states
6. **Cross-module concerns** — pricing calculation, availability, scheduling conflicts
7. **Extensibility** — how this scales to other outdoor business types

## Approach for the Session

Work like a multidisciplinary product+engineering team:
1. Explore all existing code (routes, schema, types, queries) to understand current state
2. Map all service type scenarios with real surf school examples
3. Identify gaps, duplications, wrong-level concerns
4. Propose 2-3 architectural approaches with tradeoffs
5. Design module by module, get approval per section
6. Write full spec → implementation plan

Estimated session time: 1 full day (design) + multiple implementation sessions.
