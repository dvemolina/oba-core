## In progress / next
[] - Spanish as default language for UI, consider multilanguage support (Paraglide already wired, translations near-empty)
[] - Settings page — nav link exists, no route yet (dead link)
[] - Mobile calendar narrow-width: week strip + agenda on small screens (acknowledged as future feature)

## Design
[] - Full UI/UX redesign inspired by tipitisurf.com (deprioritised — current UI is functional and clean)

## Done
[x] - Icons in navbar → Lucide icons throughout (nav, booking detail, calendar, agenda, forms)
[x] - Services: color picker instead of icons, color-coded chips in calendar/agenda
[x] - Booking detail: unified layout (no isCamp/isLesson split), flag-driven sections
[x] - Booking create: unified path (no separate camp enrollment flow), all services → createBooking
[x] - Service type: enum dropped → free-form text label, reassignable in edit form
[x] - Sessions: many-to-many booking_sessions junction, duration override, conflict detection
[x] - Session participants: per-session lightweight attendee names
[x] - Calendar day view: camp active banner when no sessions today
[x] - Today page (Agenda): sessions only, scheduling queue with direct day-view links
[x] - Bookings list: dedicated /bookings route with status + needs-scheduling filter
[x] - Nav: Bookings tab added, Agenda→Today, mobile More menu (Staff + Settings)
[x] - Calendar month/week: session-count dots replace booking bars
