## In progress / next
[] - Mobile calendar narrow-width: week strip + agenda on small screens (acknowledged as future feature)
[] - Branding — allow owners to set logo and company name (login page + app header). Maintainable branding system.
[] - Service runs: startDate/endDate on services still exists as design concept — longer-term: reusable templates where one "Surf Camp" service has multiple dated runs (design session needed for booking flow + Stripe product mapping)
[] - Events: wire up as bookable entities — client enrollment, payments, email notifications (currently calendar-only announcements)
[] - amountDue locked to basePrice on booking create — no UI for per-client pricing overrides, discounts
[] - Client portal (no client-facing booking flow yet)
[] - WhatsApp/email reminders to clients (n8n integration partially wired)
[] - Multi-tenancy: no tenant scoping yet — required before white-label SaaS

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
[x] - Multi-role users: roles[] array, primary role sync, RBAC route guards, role-filtered nav
[x] - Staff module: invite, manage roles, phone/bio/active, ban/restore — replaces instructors list
[x] - Instructors table removed: users with 'instructor' role are instructors, no separate table
[x] - DB indexes: all FK columns and hot query columns indexed
[x] - service_instructors junction table replaces JSONB default_instructor_ids
[x] - Service runs: service_runs table, camp services now have reusable template + dated runs, camp roster page
[x] - Booking participants: booking_participants table, add at create time, auto-copy to sessions
[x] - i18n: Spanish (default) + English, Paraglide, 246 keys, language toggle in sidebar/settings, all UI translated
[x] - Dashboard (Today view): session chips with payment status, day summary bar, active camps, upcoming events, unscheduled queue
[x] - Day view session chips: payment status inline (✓ paid / ⚠ partial / ⚠ unpaid) + day revenue summary bar
[x] - Settings page: account name/password, language picker (was dead link — now live)
