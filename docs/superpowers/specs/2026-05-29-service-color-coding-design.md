# Service Color Coding — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

## Goal

Replace icon-based service identification with per-service color coding. Every booking chip, calendar pill, agenda card, and booking detail view uses the service's assigned color consistently throughout the app. Status (confirmed/pending/cancelled) is communicated via a dot prefix and opacity, not by overriding the color.

---

## Data Layer

### Schema

Add `color` column to the `services` table:

```ts
color: text('color').notNull().default('ocean')
```

Stored as a color key string (e.g. `"coral"`, `"teal"`). Not raw hex — decoupled from CSS implementation.

### Color Palette — `src/lib/features/services/colors.ts`

Single source of truth. All class names written out in full (no interpolation) so Tailwind v4 does not purge them.

```ts
export const SERVICE_COLORS = {
  ocean:   { bg: 'bg-sky-100',    text: 'text-sky-800',    border: 'border-sky-400'    },
  coral:   { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-400'   },
  amber:   { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-400'  },
  teal:    { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-400'   },
  emerald: { bg: 'bg-emerald-100',text: 'text-emerald-800',border: 'border-emerald-400'},
  indigo:  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-400' },
  purple:  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-400' },
  pink:    { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-400'   },
  orange:  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400' },
  lime:    { bg: 'bg-lime-100',   text: 'text-lime-800',   border: 'border-lime-400'   },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-400'  },
  cyan:    { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-400'   },
} as const;

export type ServiceColorKey = keyof typeof SERVICE_COLORS;
export const DEFAULT_COLOR: ServiceColorKey = 'ocean';

export function getServiceColor(key: string) {
  return SERVICE_COLORS[key as ServiceColorKey] ?? SERVICE_COLORS[DEFAULT_COLOR];
}
```

### Type Updates

- `Service` type: add `color: string`
- `BookingSummary` type: add `serviceColor: string`
- Booking queries: JOIN `services.color` into booking select
- Service queries: include `color` in all selects

---

## New Components

### `src/lib/components/ColorPicker.svelte`

Props: `selected: string` (color key), `name: string` (form field name, default `"color"`).

Renders a grid of 12 colored circle swatches. Selected swatch shows a white checkmark overlay. Clicking a swatch updates the hidden input value. Used in service create and edit forms.

---

## UI Changes by Route

### `/services` (list)

- Small colored circle (10px) left of each service name.
- No other changes.

### `/services/new` and `/services/[id]` (create/edit)

- Add `ColorPicker` component to the form below the Type field.
- Server actions parse `color` from form data, validate it's a known key (fallback to `DEFAULT_COLOR`).
- View mode on `[id]`: show colored dot beside service name.

### `/calendar` (month + agenda views)

**Month view chips:**

- Background + text derived from `getServiceColor(booking.serviceColor)`.
- Status prefix dot:
  - Confirmed: `●` (filled, full opacity)
  - Pending: `○` (ring, chip at 60% opacity)
  - Cancelled: hidden (already filtered out)
- Legend added to the calendar header bar (right side, small):  
  `● Confirmed  ○ Pending` in `text-[10px] text-muted`

**Multi-day spanning pills:**

- Same service color logic. Dot prefix when `startsHere`.

**Agenda view booking cards:**

- Left border color = `border-{serviceColor}` class from palette.
- Solid border = confirmed. Dashed border = pending. (Existing `flexClass`/`statusClass` logic replaced for border-color only; opacity/dashed style for pending retained.)
- Status badge pill (confirmed/pending label) stays as-is.

### `/calendar/[date]` (day time-grid view)

- Apply same service color to booking chips in the day view.

### `/bookings/[id]` (booking detail)

- Service name row: small colored dot prefix using `serviceColor`.

---

## Status Signal Rules (applied consistently)

| Status    | Chip opacity | Dot    | Border style |
|-----------|-------------|--------|--------------|
| confirmed | 100%        | ● filled | solid      |
| pending   | 60%         | ○ ring  | dashed      |
| cancelled | hidden on calendar; muted on agenda | — | muted/solid |

---

## Migration

New Drizzle migration file. `color` column: `text`, not null, default `'ocean'`. All existing services get `'ocean'` on migration. No data loss.

---

## Out of Scope

- Freeform hex color picker
- Per-booking color override
- Color-based filtering/grouping
- UI/UX design system guidelines doc (separate spec)
- Mobile calendar week-strip view (separate feature)
