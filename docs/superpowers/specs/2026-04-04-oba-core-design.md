# OBA Core — Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Project:** Surf school planning & management web app
**Scope:** MVP — owners only, class/booking management, calendar, client & instructor DB

---

## 1. Overview

OBA Core is a self-hosted progressive web app (PWA) for managing bookings, clients, instructors, and services at an outdoor activity school. The initial target is a surf school with two owners, but the architecture is intentionally generic — designed to be sold or licensed as a SaaS to other outdoor businesses (ski schools, paragliding centres, surf camps, etc.).

**Primary users (MVP):** Two owners who manage everything day-to-day via their phones.
**Future users:** Instructors (view schedule, manage availability, receive notifications).

---

## 2. Architecture

### Approach
SvelteKit full-stack monolith. SvelteKit server routes act as the API layer under `/api/v1/`. One codebase, one Docker container. Clean API boundaries from day one so future integrations (Telegram bot via N8N, instructor mobile access) plug in without structural changes.

### Tech Stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Svelte 5 + SvelteKit 2 | Runes throughout |
| Styling | TailwindCSS v4 | Utility-first, no CSS-in-JS |
| Auth | Better Auth | Session cookies, role-based |
| ORM | Drizzle ORM | Type-safe, migration-based |
| Database | PostgreSQL | Via Docker locally, managed in prod |
| i18n | Paraglide | Ready for multi-language SaaS |
| Testing | Vitest + Playwright | Unit + e2e |
| Deployment | Docker + Nginx | Single container, VPS, Swarm-ready |

### Project Structure (feature-oriented)
```
src/
  lib/
    server/
      db/
        schema.ts          # Drizzle schema (all tables)
        index.ts           # DB client
        auth.schema.ts     # Better Auth tables (generated)
      auth.ts              # Better Auth config
    features/
      calendar/            # Calendar views & logic
      bookings/            # Booking CRUD & business logic
      clients/             # Client DB & CRM foundation
      instructors/         # Instructor DB & schedule
      services/            # Service catalogue
      events/              # Fixed calendar blocks (camps etc.)
    components/            # Shared UI components
    utils/                 # Shared utilities
  routes/
    (app)/                 # Protected routes (owners)
      calendar/
      bookings/
      clients/
      instructors/
      services/
      events/
    auth/                  # Login / logout
    api/
      v1/                  # REST API (future integrations)
        bookings/
        clients/
        instructors/
        services/
        events/
```

---

## 3. Data Model

### `users`
App logins. Managed by Better Auth.
- `id`, `email`, `name`, `role` (`owner` | `instructor`), `createdAt`
- Role `instructor` is stubbed — no instructor login in MVP, but the field is there.

### `instructors`
Staff/freelancers who teach. Separate from users (no login in MVP).
- `id`, `name`, `phone`, `email`, `bio` (nullable), `active` (boolean, default true), `userId` (nullable FK → `users` for future login), `createdAt`, `updatedAt`
- Designed for quick add/edit — volunteers can be added and removed easily.
- Future: `certifications` (jsonb), `languages` (text[]), `specialties` (text[]) — fields for bigger operations with qualification-based assignment.

### `clients`
Students / customers.
- `id`, `firstName`, `lastName`, `phone`, `email` (nullable), `nationality` (nullable), `skillLevel` (`beginner` | `intermediate` | `advanced`, nullable), `notes` (nullable), `createdAt`, `updatedAt`
- Minimal for MVP. Full booking history is queryable via `booking_clients` relation.
- Future CRM fields: `marketingConsent`, `referralSource`, `preferredContact` — addable without schema migration disruption.

### `services`
The product catalogue.
- `id`, `name`, `description` (nullable), `type` (`lesson` | `camp` | `product` | `rental`), `durationMinutes` (nullable), `basePrice` (numeric), `active` (boolean, default true), `createdAt`, `updatedAt`
- `type` drives validation logic — a `lesson` requires `durationMinutes`, a `product` does not.
- Future types: `accommodation`, `equipment_rental` — just new enum values, no schema change.

### `bookings`
Core operational table. Links clients → service → instructor.
- `id`, `serviceId` (FK), `instructorId` (nullable FK), `date` (date), `time` (time, nullable), `isFlexible` (boolean) — flexible = time/spot TBD based on conditions
- `status`: `pending` | `confirmed` | `cancelled`
- `spotNotes` (text, nullable) — free-text for surf spot, location, logistics
- `notes` (text, nullable) — internal notes
- `createdAt`, `updatedAt`

### `booking_clients`
Join table — one booking can have multiple clients (group lessons). Tracks payment per client.
- `id`, `bookingId` (FK), `clientId` (FK)
- `amountDue` (numeric), `amountPaid` (numeric, default 0)
- `paymentStatus`: `pending` | `partial` | `paid`
- Future: `invoiceSentAt`, `invoiceUrl` — automated invoicing hooks in without touching the rest.

### `events`
Fixed calendar blocks — surf camps, external collaborations, partner events.
- `id`, `title`, `description` (nullable), `startDate` (date), `endDate` (date), `serviceId` (nullable FK), `price` (nullable numeric), `notes` (nullable), `createdAt`, `updatedAt`
- These are read-only anchors on the calendar. Not malleable. Not linked to individual clients.

---

## 4. Features

### 4.1 Auth
- Email + password login via Better Auth
- Session cookies (HTTP-only, signed)
- Single middleware guard on all `(app)` routes
- No registration UI — owners seeded via a one-time seed script
- Role field stubbed for future instructor access

### 4.2 Calendar
- **Default view:** Agenda (chronological list of bookings grouped by day)
- **Available views:** Agenda · Month · Week — toggled via a segmented control in the header
- Month view: dots on days with bookings, full-width event bars for multi-day camps
- Bookings render with visual distinction:
  - Solid left border + soft fill = confirmed
  - Dashed left border + amber tint = flexible (time TBD)
  - Green chip = paid · Amber chip = partial/pending · Red chip = cancelled
- Tap any booking → opens booking detail
- Tap empty day slot / `+` FAB → opens new booking form
- Navigation: swipe left/right on month view, prev/next arrows on week

### 4.3 Bookings
Full CRUD. The most-used feature.

**Create flow (full-screen form):**
1. Date picker (defaults to tapped day)
2. Time picker + "Flexible time" toggle (disables time input when on)
3. Service selector (dropdown from active services)
4. Client field — hybrid search/create:
   - Type name → searches existing clients by name
   - No match → "Create new: [name]" creates a minimal client record on the fly
   - Multiple clients shown as chips (remove with ✕)
5. Instructor selector — chips from active instructors (optional)
6. Payment section per client: amount due (auto-filled from service base price), amount paid, payment status
7. Spot notes + internal notes (collapsible)
8. Save → returns to calendar at that date

**Edit:** Same form, pre-filled. Status change (confirm / cancel) is a prominent action button.
**Delete:** Soft delete (sets `status = cancelled`), with confirmation dialog.

### 4.4 Clients
- List view: searchable by name, filterable by skill level / nationality
- Client card: name, contact, skill level badge, booking count
- Client detail page: profile + full booking history (past + upcoming)
- Create/edit: inline form (name, phone, email, nationality, skill level, notes)
- On-the-fly creation from the booking form creates a minimal record; owners can enrich it later

### 4.5 Instructors
- List view: active instructors as cards
- Quick add/edit: name, phone, email, bio, active toggle
- Instructor detail: upcoming assigned bookings (their schedule view)
- `active` toggle for seasonal availability — deactivated instructors hidden from booking assignment but data preserved

### 4.6 Services
- List view grouped by type (lessons, camps, products, rentals)
- Create/edit: name, type, duration (conditional on type), base price, description, active toggle
- Active toggle — deactivated services hidden from booking form but historical data intact

### 4.7 Events
- Calendar blocks for fixed date-range events (surf camps, collaborations)
- Create/edit: title, date range, price, description, optional service link, notes
- Appear on calendar as full-width bars spanning their date range
- No client/instructor assignment — managed externally

### 4.8 API Layer (`/api/v1/`)
- REST endpoints for all entities: `bookings`, `clients`, `instructors`, `services`, `events`
- Consistent response envelope: `{ data, error, meta }`
- Auth: session cookie (same as UI) + future API key header support for N8N/Telegram
- Versioned from day one — breaking changes go to `/api/v2/`
- No UI for this — integration surface only

---

## 5. UI/UX

### Navigation
- **Mobile:** Bottom tab bar — Calendar · Clients · Staff · Services · Settings
- **Desktop:** Collapsed icon sidebar — same sections, expands on hover to show labels
- Active section highlighted. `+` FAB (floating action button) always visible on calendar screen.

### Design Language
- Clean, minimal, outdoors-inspired — professional without being corporate
- **Palette:**
  - Navy `#1a1a2e` — nav, headers
  - Ocean blue `#3a86ff` — primary actions, today indicator
  - Sand `#f8f6f0` — page backgrounds
  - Confirmed/paid green `#51cf66`
  - Pending amber `#ffd43b`
  - Flexible/unconfirmed coral `#ff6b6b`
- **Typography:** Inter or DM Sans — legible at small sizes on mobile
- **Motion:** Subtle transitions (slide-up panels, fade-in lists) — responsive, not decorative

### PWA
- Installable on iOS/Android home screen
- Service worker for offline read-only access (calendar + today's bookings cached)
- Web app manifest with splash screen and icons

---

## 6. API Design

### Endpoints (MVP)
```
GET    /api/v1/bookings         list (filterable: date, status, instructorId)
POST   /api/v1/bookings         create
GET    /api/v1/bookings/:id     detail
PATCH  /api/v1/bookings/:id     update
DELETE /api/v1/bookings/:id     soft delete (cancel)

GET    /api/v1/clients          list (searchable: name, skill, nationality)
POST   /api/v1/clients          create
GET    /api/v1/clients/:id      detail + booking history
PATCH  /api/v1/clients/:id      update

GET    /api/v1/instructors      list
POST   /api/v1/instructors      create
PATCH  /api/v1/instructors/:id  update

GET    /api/v1/services         list
POST   /api/v1/services         create
PATCH  /api/v1/services/:id     update

GET    /api/v1/events           list (filterable: date range)
POST   /api/v1/events           create
PATCH  /api/v1/events/:id       update
DELETE /api/v1/events/:id       hard delete
```

### Response Envelope
```json
{
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "total": 42 }
}
```

---

## 7. Deployment

- Single Docker container running the SvelteKit Node adapter
- `compose.yaml` for local dev (Postgres + app)
- Production: VPS with Nginx reverse proxy, Docker (Swarm-ready with health check at `/health`)
- Environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ORIGIN`
- DB migrations via `drizzle-kit migrate` run at container startup

---

## 8. Out of Scope (MVP)

- Instructor login / notifications
- Automated invoicing / email sending
- Telegram bot / N8N integration (API layer is ready for it)
- Online client booking (public-facing)
- Payment processing (Stripe etc.)
- Multi-tenant / SaaS mode
- Surf spot / location management
- Advanced CRM (marketing consent, referral tracking)

---

## 9. Future Extensibility Notes

- **Instructor access:** Add a user record linked to `instructors.userId`, restrict API to their own bookings
- **Telegram/N8N:** POST to `/api/v1/bookings` with an API key — no code change required
- **SaaS:** Add `tenantId` to all tables, middleware scopes all queries by tenant
- **CRM:** `clients` table has notes + full booking history queryable today; add fields progressively
- **Invoicing:** `booking_clients` already has `invoiceSentAt` stub; wire up a PDF generator + mailer
- **Other outdoor businesses:** `services.type` enum + conditional validation = ski school just adds `lift_pass`, paragliding adds `flight` — same schema
