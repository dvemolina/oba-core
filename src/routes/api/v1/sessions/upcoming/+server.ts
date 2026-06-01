/**
 * GET /api/v1/sessions/upcoming?hours=24
 *
 * Returns scheduled sessions happening within the next N hours,
 * with client contact info. Designed for n8n to poll and send
 * WhatsApp/email reminders automatically.
 *
 * Response per session:
 *   sessionId, date, time, serviceName,
 *   clients: [{ name, phone, email, bookingId }]
 */
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sessions, bookingSessions, bookings, bookingClients, clients, services } from '$lib/server/db/schema';
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { sessionInstructors, instructors } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const hoursAhead = Math.min(72, Math.max(1, parseInt(event.url.searchParams.get('hours') ?? '24')));

	const now = new Date();
	const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

	// Date range for the window
	const fromDate = now.toISOString().slice(0, 10);
	const toDate = cutoff.toISOString().slice(0, 10);
	const fromTime = now.toTimeString().slice(0, 5);
	const cutoffTime = cutoff.toTimeString().slice(0, 5);

	// Fetch scheduled sessions in the window (not cancelled)
	const sessionRows = await db
		.select({
			id: sessions.id,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status
		})
		.from(sessions)
		.where(and(
			eq(sessions.status, 'scheduled'),
			gte(sessions.date, fromDate),
			lte(sessions.date, toDate)
		))
		.orderBy(sessions.date, sessions.time);

	if (sessionRows.length === 0) return apiResponse([]);

	const sessionIds = sessionRows.map(r => r.id);

	// Booking links + service names
	const links = await db
		.select({
			sessionId: bookingSessions.sessionId,
			bookingId: bookingSessions.bookingId,
			serviceName: services.name,
			bookingStatus: bookings.status
		})
		.from(bookingSessions)
		.leftJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(and(
			sql`${bookingSessions.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
			ne(bookings.status, 'cancelled')
		));

	const bookingIds = [...new Set(links.map(l => l.bookingId).filter(Boolean))] as string[];

	// Enrolled clients
	const clientRows = bookingIds.length > 0
		? await db
			.select({
				bookingId: bookingClients.bookingId,
				firstName: clients.firstName,
				lastName: clients.lastName,
				phone: clients.phone,
				email: clients.email
			})
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(
				inArray(bookingClients.bookingId, bookingIds),
				eq(bookingClients.status, 'enrolled')
			))
		: [];

	// Instructors
	const instrRows = await db
		.select({
			sessionId: sessionInstructors.sessionId,
			instructorName: instructors.name
		})
		.from(sessionInstructors)
		.leftJoin(instructors, eq(sessionInstructors.instructorId, instructors.id))
		.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`);

	// Assemble
	const linksBySession: Record<string, typeof links> = {};
	for (const l of links) (linksBySession[l.sessionId] ??= []).push(l);

	const clientsByBooking: Record<string, typeof clientRows> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(r);

	const instructorsBySession: Record<string, string[]> = {};
	for (const r of instrRows) (instructorsBySession[r.sessionId] ??= []).push(r.instructorName ?? '');

	const result = sessionRows
		.filter(s => (linksBySession[s.id] ?? []).length > 0)
		.map(s => {
			const sl = linksBySession[s.id] ?? [];
			const allClients = sl.flatMap(l => (clientsByBooking[l.bookingId] ?? []).map(c => ({
				name: `${c.firstName} ${c.lastName}`.trim(),
				phone: c.phone,
				email: c.email,
				bookingId: l.bookingId
			})));

			return {
				sessionId: s.id,
				date: s.date,
				time: s.time,
				notes: s.notes,
				serviceName: sl[0]?.serviceName ?? null,
				instructors: instructorsBySession[s.id] ?? [],
				clients: allClients
			};
		})
		// Filter to sessions actually within the time window
		.filter(s => {
			if (!s.time) return false;
			if (s.date === fromDate && s.time < fromTime) return false;
			if (s.date === toDate && s.time > cutoffTime) return false;
			return true;
		});

	return apiResponse(result);
};
