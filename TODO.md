## In progress / next
[] - En el calendario, si hay una sesion/reserva, aparece como un puntito, no se ve una ficha como en Google Calendar o en otros top names similares.
[] - Optimizar pasos en la creacion de Reserva --> Detalles de la reserva, e incluso si alguna parte de la logica pertenece a la creacion del servicio unidades de inventario. En la vista de semana, estaria bien mostrar info como la de el dia, como nombre cliente, participantes, precio etc? (Que se miuestre los mismo en ambas, solo limitado si en alguna se ha de mostrar menos por tamaño, pero hacer DRY el uso de esta informacion a lo largo del proyecto)
[] - Cuando se hace una reserva que incluye algo del inventario, por ejemplo en el caso de neoprenos o tablas 2ue no sabes que va a utilizar de talla hasta que llegue el cliente delante, estaria bien poder asignar que va. ausar un neopreno y una tabla aunque no sepamos exactamente qual o que variante. Asi se podrian dar informaciones de tipo: ojo se necesitaran x items libres de estos para este dia/sesion/reserva Incluso poder ver en inventario que va a haver x items en uso par ese dia, aunque no se sepa especificamente qual, y si se sabe pues mejor.
[] - En la parte servicio que tiene inventario, en los detalles, que es cuando assignas que tipo de producto ese servicio tiene asociados, queda poco claro lo de incluido, y abajo lo de precio i modalidad de precio, o crees que tiene buena UI/UX? Ademas, este paso concreto se deberia poner a nivel de cuando se crea la reserva? Hace falta internacionalizar tambien al español.
[] - En nueva reserva cambiar el boton de rservar alojamiento por crear reserva.
[] - En la creacion de servicio cuando añades que tiene inventario, aparece un input de unidades disponibles, con un placeholder de 8tabla, 4 habitaciones. Pero ese dato realmente no sirve àra nada, lo que se deberia decididr es que tipos de producto se van asociar (o an a estar disponibles) para asignar en los detalles de la reserva.
[] - Al crear reserva en caso de que tenga fechas concretas (ediciones), a la hora de crear una reserva y seleccionar el servicio, no deberia salir un input de fecha. Algun otro caso que el input de fecha no sirva? Ademas este es el caso que para nueva reserva, segun el producto y que modulos tiene el producto, ciertos datos se deberian pedir o se siente de forma natural darlos en ese instante de crear una resevra. es como un formulario a nivel de reserva nueva que tendria que introducir esa logica de refactorizacion que hablamos. Ademas algo pasa en vista calendario, en todas sus views, que un producto que tiene ediciones concretos, deberia aparecer en el calendario auqnue no tenga ningun a reserva ctiva aun porque al ser cosas concretas que pasan en un tiempo determinado, las managers les va bien visualmente ver eso, aunque luego se tenga que meter en la reserva para ver detalles o que diga en los chips, que uan no hay cleinte asociado= quizas mostrarlo visualmente la chip con color faded y al enrollar a alguien se "activa"
[] - En la creacion de servicio, cuando tiene sessiones, se puede determinar el numero de sessiones que tiene por defecto ese servicio. (Por ejemplo en la logico de un cmap de 1 semana de 5 sesiones incluidas). Así se utiliza la logica que ya hay creada sobre, este servicio que pasa estas fechas concretas(porque tambien tiene ese modulo activado el camp), que tiene x sesiones, hay x sesiones assignadas de un x total.
[] - A nivel de modulo participantes en la reserva, implementar lo siguiente:
        - El cliente tambien es participante
        - A nivel de sesiones, todos los participantes, partticipan en la session/todas las sessiones
[] - En detalles de reserva y nueva rserva, importante una seccion de notas o observaciones, para poder registrar osas que no esten contempladas por el modelo de datos de la app.
[] - Branding — allow owners to set logo and company name (login page + app header). Maintainable branding system.
[] - Service runs: startDate/endDate on services still exists as design concept — longer-term: reusable templates where one "Surf Camp" service has multiple dated runs (design session needed for booking flow + Stripe product mapping)
[] - Events: wire up as bookable entities — client enrollment, payments, email notifications (currently calendar-only announcements)
[] - amountDue locked to basePrice on booking create — no UI for per-client pricing overrides, discounts
[] - Client portal (no client-facing booking flow yet)
[] - WhatsApp/email reminders to clients (n8n integration partially wired)
[] - Multi-tenancy: no tenant scoping yet — required before white-label SaaS
[] - Choerency and homogeneization in between each tab of the app. Template reused or adpated for each tab, but with a clear and continued hierarchy and semantics? Now it feels like each page on the app and every component is just different and not cohesive.

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
