# Booking Flow Redesign

**Date:** 2026-06-04
**Status:** Approved

## Problem

1. Creating a session-based booking requires too many steps: create booking → navigate to detail → add/configure sessions. Owners typically have all session details upfront and want one single form.
2. The participant name requirement is too strict — for group lessons, the owner often only knows the headcount, not individual names.
3. No skill level field on sessions, despite the `skillLevelEnum` already existing in the schema.
4. ~45 hardcoded English strings across the new-booking and booking-detail pages.
5. The booking form structure is inconsistent — each service type has a bespoke layout with no shared visual language.

## Goals

- One form, one submit: booking + sessions created atomically.
- Participant count (anonymous) as an alternative to named participants.
- Skill level set at booking time, applied to all auto-created sessions.
- Unified accordion pattern for all booking types (sessions, accommodation, camp, regular).
- All visible strings i18n-covered in `en.json` and `es.json`.

## Out of Scope

- Booking detail page structural rework (only targeted additions).
- Payment flow changes.
- WhatsApp bot changes.

---

## Section 1: Data Model

### Migration 1 — `bookings` table
```sql
ALTER TABLE bookings ADD COLUMN participant_count INTEGER;
```
- Nullable. `NULL` means named participants are used (`booking_participants` table).
- When set, represents anonymous headcount. Both can coexist (e.g. count=5, 2 names known).

### Migration 2 — `sessions` table
```sql
ALTER TABLE sessions ADD COLUMN skill_level skill_level;
```
- Nullable. Reuses existing `skill_level` enum: `beginner | intermediate | advanced`.
- Set at booking creation, applied to all auto-created sessions.
- Editable per-session afterwards via the inline edit form on the booking detail page.

**Schema file:** `src/lib/server/db/schema.ts`
- Add `participantCount: integer('participant_count')` to `bookings` table.
- Add `skillLevel: skillLevelEnum('skill_level')` to `sessions` table.

---

## Section 2: Booking Form — Unified Accordion

### Component structure

```
src/lib/components/bookings/
  FormSection.svelte          ← reusable accordion shell
  sections/
    BookingBasics.svelte       ← service, dates, participant count/names toggle, client
    SessionSection.svelte      ← one per session N: date, time, level, instructor, notes
    ClientsSection.svelte      ← client search/add (accommodation, camp, regular)
    RepeatDays.svelte          ← multi-day repeat (regular services)
    NotesSection.svelte        ← internal notes, collapsed by default
```

### `FormSection.svelte` API
```svelte
<FormSection title="Session 1" badge="Not scheduled" open={false}>
  <!-- slot content -->
</FormSection>
```
Props: `title` (string), `badge` (string | null), `badgeVariant` ('done'|'progress'|'neutral'), `open` (boolean).

### Section composition by service type

| Section | Lesson | Accommodation | Camp | Regular |
|---|---|---|---|---|
| BookingBasics | ✓ | ✓ | ✓ | ✓ |
| SessionSection × N | ✓ | — | — | — |
| ClientsSection | — (inside Basics) | ✓ | ✓ | ✓ |
| RepeatDays | — | — | — | ✓ collapsed |
| NotesSection | ✓ collapsed | ✓ collapsed | ✓ collapsed | ✓ collapsed |

### Participant count toggle (BookingBasics, lesson mode)
- Two modes: **"Just a count"** (default) and **"Add names"**.
- "Just a count": single `<input type="number">` → sends `participantCount` to server.
- "Add names": current multi-input → sends named `participants[]` to server.
- Server: if `participantCount` present → save to `bookings.participantCount`, skip `bookingParticipants` insert.

### Session accordion behavior
- Session 1 starts open.
- Sessions 2–N start collapsed with badge "Not scheduled".
- User expands any session to fill details before submit; unexpanded = unscheduled (still created).
- `skillLevel` is a booking-level default shown in Session 1's section. Sessions 2–N inherit it but can override independently.
- One submit creates booking + all N sessions atomically (no change to existing session factory logic, just passes new fields through).

### Level selector (SessionSection)
Three pill buttons: Beginner · Intermediate · Advanced. Optional (nullable). Same row as instructor.

---

## Section 3: i18n

All hardcoded strings in these two files are extracted and replaced with `m.key()` calls:
- `src/routes/(app)/bookings/new/+page.svelte`
- `src/routes/(app)/bookings/[id]/+page.svelte`

Both `messages/en.json` and `messages/es.json` updated together.

### New keys required (new features)

| Key | English | Spanish |
|---|---|---|
| `booking_new_participant_count` | "Number of participants" | "Número de participantes" |
| `booking_new_participant_mode_count` | "Just a count" | "Solo cantidad" |
| `booking_new_participant_mode_names` | "Add names" | "Añadir nombres" |
| `booking_new_session_n` | "Session {n}" | "Sesión {n}" |
| `booking_new_session_of` | "of {total}" | "de {total}" |
| `booking_new_session_not_scheduled` | "Not scheduled" | "Sin programar" |
| `booking_new_notes_section` | "Notes" | "Notas" |
| `booking_new_level` | "Level" | "Nivel" |
| `skill_level_beginner` | "Beginner" | "Principiante" |
| `skill_level_intermediate` | "Intermediate" | "Intermedio" |
| `skill_level_advanced` | "Advanced" | "Avanzado" |
| `booking_detail_session_level` | "Level" | "Nivel" |
| `booking_detail_session_generate` | "Generate" | "Generar" |
| `booking_detail_session_add` | "+ Add" | "+ Añadir" |
| `booking_detail_session_save` | "Save session" | "Guardar sesión" |
| `booking_detail_session_edit` | "Edit" | "Editar" |
| `booking_detail_session_unscheduled` | "Unscheduled" | "Sin programar" |
| `booking_detail_session_attending` | "Attending" | "Asistentes" |
| `booking_detail_session_new` | "New session" | "Nueva sesión" |
| `booking_detail_session_date` | "Date *" | "Fecha *" |
| `booking_detail_session_time` | "Time" | "Hora" |
| `booking_detail_session_duration` | "Duration (min)" | "Duración (min)" |
| `booking_detail_session_notes` | "Notes / spot" | "Notas / spot" |
| `booking_detail_session_instructors` | "Instructors" | "Instructores" |
| `booking_detail_session_cancel_confirm` | "Cancel this session?" | "¿Cancelar esta sesión?" |
| `booking_detail_session_defaults_to_client` | "Defaults to booking client" | "Por defecto el cliente de la reserva" |
| `booking_detail_generate_sessions` | "Generate sessions" | "Generar sesiones" |
| `booking_detail_generate_for` | "Generate for {start} → {end}" | "Generar para {start} → {end}" |
| `booking_detail_sessions_per_day` | "Sessions / day" | "Sesiones / día" |
| `booking_detail_sessions_times` | "Times" | "Horas" |
| `booking_detail_weekdays_only` | "Weekdays only" | "Solo días laborables" |
| `booking_detail_clear_existing` | "Clear existing sessions first" | "Eliminar sesiones existentes primero" |
| `booking_detail_no_sessions` | "No sessions yet — use Generate or + Add." | "Sin sesiones — usa Generar o + Añadir." |
| `booking_detail_needs_time` | "Needs a time assigned" | "Necesita hora asignada" |
| `booking_detail_cancelled_label` | "Cancelled" | "Cancelado" |
| `booking_detail_save_payment` | "Save" | "Guardar" |
| `booking_new_no_unit_types` | "No unit types configured for this property. Add them in the service settings first." | "No hay tipos de unidad configurados. Añádelos en los ajustes del servicio." |
| `booking_new_saving` | "Saving…" | "Guardando…" |
| `booking_new_additional_days` | "Additional days" | "Días adicionales" |

---

## Section 4: Booking Detail — Targeted Updates

### Session cards
- Add skill level badge (pill, same style as role badges) next to status badge.
- Badge only shown if `skillLevel` is set.

### Booking details panel
- If `participantCount` set: show "X participants" in the details section.
- Named participants list unchanged — shown when present.

### Visual hierarchy
- Sessions section header styled with subtle left-border accent to visually nest sessions under the booking.
- Each session card prefixed "Session N of total" (e.g. "Session 1 of 3").

### Session inline edit form
- Add level selector (same pill buttons as new booking form) to the edit form.
- Sends `level` on save, updates `sessions.skillLevel`.

---

## Server Action Changes

### `bookings/new/+page.server.ts`
- Accept `participantCount` (integer, optional).
- Accept `skillLevel` (enum, optional) — applied to session 1, inherited by all.
- Accept per-session fields: `sessionTime[n]`, `sessionInstructor[n]`, `sessionLevel[n]` (optional overrides).
- Session factory loop: set `skillLevel` on each session from `sessionLevel[n]` or fallback to booking-level `skillLevel`.
- Participant mode: if `participantCount` sent → save to booking, skip `bookingParticipants` insert.

### `bookings/[id]/+page.server.ts`
- Add `updateSessionLevel` action: accepts `sessionId` + `level`, updates `sessions.skillLevel`.
- Existing session update action: add `level` field.
