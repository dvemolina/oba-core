// src/lib/features/bookings/queries.ts
import { and, count, eq, gte, lte, desc, inArray, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	bookings,
	bookingClients,
	bookingInstructors,
	bookingSessions,
	clients,
	services,
	sessions,
	accommodationUnits,
	accommodationUnitTypes
} from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import type { Service } from '$lib/features/services/types';
import type {
	Booking,
	BookingClient,
	BookingListItem,
	BookingSummary,
	ClientBookingSummary,
	CreateBookingInput,
	UpdateBookingInput
} from './types';

async function attachInstructorsToBookings<T extends { id: string }>(
	rows: T[]
): Promise<(T & { instructorId: string | null; instructorName: string | null })[]> {
	if (rows.length === 0) return rows.map(r => ({ ...r, instructorId: null, instructorName: null }));

	const ids = rows.map(r => r.id);
	const instrRows = await db
		.select({
			bookingId: bookingInstructors.bookingId,
			instructorId: bookingInstructors.instructorId,
			instructorName: userTable.name
		})
		.from(bookingInstructors)
		.leftJoin(userTable, eq(bookingInstructors.instructorId, userTable.id))
		.where(inArray(bookingInstructors.bookingId, ids));

	const byBooking: Record<string, { instructorId: string; instructorName: string | null }> = {};
	for (const r of instrRows) {
		if (!byBooking[r.bookingId]) {
			byBooking[r.bookingId] = { instructorId: r.instructorId, instructorName: r.instructorName };
		}
	}

	return rows.map(r => ({
		...r,
		instructorId: byBooking[r.id]?.instructorId ?? null,
		instructorName: byBooking[r.id]?.instructorName ?? null
	}));
}

export async function listBookingsForDateRange(
	from: string,
	to: string
): Promise<BookingSummary[]> {
	const rows = await db
		.select({
			id: bookings.id,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceHasDateRange: services.hasDateRange,
			serviceHasInventoryUnits: services.hasInventoryUnits,
			serviceRequiresInstructor: services.requiresInstructor,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		// Overlap: booking starts before range ends AND booking ends (or is same-day) after range starts
		.where(and(
			lte(bookings.date, to),
			gte(sql`COALESCE(${bookings.dateEnd}, ${bookings.date})`, from)
		))
		.orderBy(bookings.date, bookings.time);

	const withInstructors = await attachInstructorsToBookings(rows);

	const ids = withInstructors.map(r => r.id);
	const counts: Record<string, number> = {};
	const firstClientNames: Record<string, string> = {};
	if (ids.length > 0) {
		const clientRows = await db
			.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName })
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(inArray(bookingClients.bookingId, ids));
		for (const row of clientRows) {
			counts[row.bookingId] = (counts[row.bookingId] ?? 0) + 1;
			if (!firstClientNames[row.bookingId] && row.firstName) firstClientNames[row.bookingId] = row.firstName;
		}
	}

	return withInstructors.map(r => ({
		...r,
		clientCount: counts[r.id] ?? 0,
		firstClientName: firstClientNames[r.id] ?? null
	})) as BookingSummary[];
}

export async function listAllBookings(): Promise<BookingListItem[]> {
	const rows = await db
		.select({
			id: bookings.id,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceHasDateRange: services.hasDateRange,
			serviceHasInventoryUnits: services.hasInventoryUnits,
			serviceRequiresInstructor: services.requiresInstructor,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		.orderBy(desc(bookings.date));

	const withInstructors = await attachInstructorsToBookings(rows);
	const ids = withInstructors.map(r => r.id);
	if (ids.length === 0) return [];

	const [clientRows, sessionRows] = await Promise.all([
		db.select({ bookingId: bookingClients.bookingId, firstName: clients.firstName })
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(inArray(bookingClients.bookingId, ids)),
		db.select({
			bookingId: bookingSessions.bookingId,
			sessionId: bookingSessions.sessionId,
			status: sessions.status
		})
			.from(bookingSessions)
			.leftJoin(sessions, eq(bookingSessions.sessionId, sessions.id))
			.where(inArray(bookingSessions.bookingId, ids))
	]);

	const counts: Record<string, number> = {};
	const firstClientNames: Record<string, string> = {};
	for (const r of clientRows) {
		counts[r.bookingId] = (counts[r.bookingId] ?? 0) + 1;
		if (!firstClientNames[r.bookingId] && r.firstName) firstClientNames[r.bookingId] = r.firstName;
	}

	const sessionCounts: Record<string, number> = {};
	const scheduledCounts: Record<string, number> = {};
	for (const r of sessionRows) {
		sessionCounts[r.bookingId] = (sessionCounts[r.bookingId] ?? 0) + 1;
		if (r.status === 'scheduled') scheduledCounts[r.bookingId] = (scheduledCounts[r.bookingId] ?? 0) + 1;
	}

	return withInstructors.map(r => ({
		...r,
		clientCount: counts[r.id] ?? 0,
		firstClientName: firstClientNames[r.id] ?? null,
		sessionCount: sessionCounts[r.id] ?? 0,
		scheduledCount: scheduledCounts[r.id] ?? 0
	})) as BookingListItem[];
}

export async function getBooking(id: string): Promise<Booking | undefined> {
	const [booking] = await db
		.select({
			id: bookings.id,
			serviceId: bookings.serviceId,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceHasRoster: services.hasRoster,
			serviceMaxCapacity: services.maxCapacity,
			accommodationUnitId: bookings.accommodationUnitId,
			accommodationUnitName: accommodationUnits.name,
			accommodationUnitTypeName: accommodationUnitTypes.name,
			guestsCount: bookings.guestsCount,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			sessionsIncluded: bookings.sessionsIncluded,
			isFlexible: bookings.isFlexible,
			status: bookings.status,
			source: bookings.source,
			spotNotes: bookings.spotNotes,
			notes: bookings.notes,
			createdAt: bookings.createdAt,
			updatedAt: bookings.updatedAt
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(accommodationUnits, eq(bookings.accommodationUnitId, accommodationUnits.id))
		.leftJoin(accommodationUnitTypes, eq(accommodationUnits.unitTypeId, accommodationUnitTypes.id))
		.where(eq(bookings.id, id));

	if (!booking) return undefined;

	const [instrRow] = await db
		.select({ instructorId: bookingInstructors.instructorId, instructorName: userTable.name })
		.from(bookingInstructors)
		.leftJoin(userTable, eq(bookingInstructors.instructorId, userTable.id))
		.where(eq(bookingInstructors.bookingId, id))
		.limit(1);

	const bookingClientRows = await db
		.select({
			id: bookingClients.id,
			bookingId: bookingClients.bookingId,
			clientId: bookingClients.clientId,
			clientFirstName: clients.firstName,
			clientLastName: clients.lastName,
			clientPhone: clients.phone,
			clientEmail: clients.email,
			status: bookingClients.status,
			amountDue: bookingClients.amountDue,
			amountPaid: bookingClients.amountPaid,
			paymentStatus: bookingClients.paymentStatus,
			cancelledAt: bookingClients.cancelledAt
		})
		.from(bookingClients)
		.leftJoin(clients, eq(bookingClients.clientId, clients.id))
		.where(eq(bookingClients.bookingId, id));

	return {
		...booking,
		instructorId: instrRow?.instructorId ?? null,
		instructorName: instrRow?.instructorName ?? null,
		clients: bookingClientRows
	} as Booking;
}

export async function getBookingsForClient(clientId: string): Promise<ClientBookingSummary[]> {
	const rows = await db
		.select({
			id: bookings.id,
			date: bookings.date,
			time: bookings.time,
			serviceName: services.name,
			status: bookings.status
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(eq(bookingClients.clientId, clientId))
		.orderBy(desc(bookings.date));
	return rows as ClientBookingSummary[];
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
	const [booking] = await db
		.insert(bookings)
		.values({
			serviceId: input.serviceId,
			accommodationUnitId: input.accommodationUnitId,
			guestsCount: input.guestsCount,
			date: input.date,
			dateEnd: input.dateEnd,
			time: input.time,
			sessionsIncluded: input.sessionsIncluded,
			isFlexible: input.isFlexible,
			status: input.status ?? (input.source === 'whatsapp_bot' ? 'pending' : 'confirmed'),
			source: input.source ?? 'admin',
			spotNotes: input.spotNotes,
			notes: input.notes
		})
		.returning();

	if (input.instructorId) {
		await db.insert(bookingInstructors).values({
			bookingId: booking.id,
			instructorId: input.instructorId
		});
	}

	if (input.clients.length > 0) {
		await db.insert(bookingClients).values(
			input.clients.map((c) => ({
				bookingId: booking.id,
				clientId: c.clientId,
				amountDue: c.amountDue,
				amountPaid: '0',
				paymentStatus: 'pending' as const
			}))
		);
	}

	return (await getBooking(booking.id))!;
}

/** Count enrolled clients across all active bookings for a service. Used for capacity checks. */
export async function countEnrolledClientsForService(serviceId: string): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(and(
			eq(bookings.serviceId, serviceId),
			ne(bookings.status, 'cancelled'),
			eq(bookingClients.status, 'enrolled')
		));
	return Number(row?.total ?? 0);
}

/** For camps: find the single booking for this service, or create it (empty, no clients yet). */
export async function getOrCreateCampBooking(service: Service): Promise<Booking> {
	if (!service.startDate) throw new Error('Service has no start date');

	const [existing] = await db
		.select({ id: bookings.id })
		.from(bookings)
		.where(and(
			eq(bookings.serviceId, service.id),
			eq(bookings.date, service.startDate),
			ne(bookings.status, 'cancelled')
		))
		.limit(1);

	if (existing) return (await getBooking(existing.id))!;

	const [created] = await db
		.insert(bookings)
		.values({
			serviceId: service.id,
			date: service.startDate,
			dateEnd: service.endDate ?? service.startDate,
			isFlexible: false,
			status: 'confirmed'
		})
		.returning();

	return (await getBooking(created.id))!;
}

/** Enroll a single client in an existing booking (camp roster add). */
export async function addClientToBooking(
	bookingId: string,
	clientId: string,
	amountDue: string
): Promise<void> {
	await db.insert(bookingClients).values({
		bookingId,
		clientId,
		amountDue,
		amountPaid: '0',
		paymentStatus: 'pending'
	});
}

/** Remove a client from a booking (camp unenroll). */
export async function removeClientFromBooking(
	bookingId: string,
	clientId: string
): Promise<void> {
	await db
		.delete(bookingClients)
		.where(and(eq(bookingClients.bookingId, bookingId), eq(bookingClients.clientId, clientId)));
}

export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {
	const { instructorId, ...rest } = input;
	await db
		.update(bookings)
		.set({ ...rest, updatedAt: new Date() })
		.where(eq(bookings.id, id));

	if (instructorId !== undefined) {
		await db.delete(bookingInstructors).where(eq(bookingInstructors.bookingId, id));
		if (instructorId) {
			await db.insert(bookingInstructors).values({ bookingId: id, instructorId });
		}
	}

	return (await getBooking(id))!;
}

export async function updateBookingClientPayment(
	bookingClientId: string,
	amountPaid: string,
	paymentStatus: 'pending' | 'partial' | 'paid'
): Promise<void> {
	await db
		.update(bookingClients)
		.set({ amountPaid, paymentStatus })
		.where(eq(bookingClients.id, bookingClientId));
}

export async function updateBookingClientAmountDue(
	bookingClientId: string,
	amountDue: string
): Promise<void> {
	const due = parseFloat(amountDue);
	const [bc] = await db.select({ amountPaid: bookingClients.amountPaid }).from(bookingClients).where(eq(bookingClients.id, bookingClientId));
	const paid = parseFloat(bc?.amountPaid ?? '0');
	const paymentStatus = paid >= due ? 'paid' : paid > 0 ? 'partial' : 'pending';
	await db.update(bookingClients).set({ amountDue, paymentStatus }).where(eq(bookingClients.id, bookingClientId));
}

export async function cancelBookingClient(bookingClientId: string): Promise<void> {
	await db
		.update(bookingClients)
		.set({ status: 'cancelled', cancelledAt: new Date() })
		.where(eq(bookingClients.id, bookingClientId));
}

export async function reenrollBookingClient(bookingClientId: string): Promise<void> {
	await db
		.update(bookingClients)
		.set({ status: 'enrolled', cancelledAt: null })
		.where(eq(bookingClients.id, bookingClientId));
}

export async function cancelBooking(id: string): Promise<void> {
	// Cancel the booking
	await db.update(bookings).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(bookings.id, id));

	// Cancel sessions that are exclusively linked to this booking (not shared with others)
	const links = await db
		.select({ sessionId: bookingSessions.sessionId })
		.from(bookingSessions)
		.where(eq(bookingSessions.bookingId, id));

	for (const { sessionId } of links) {
		const otherActiveLinks = await db
			.select({ id: bookingSessions.id })
			.from(bookingSessions)
			.innerJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
			.where(and(
				eq(bookingSessions.sessionId, sessionId),
				ne(bookingSessions.bookingId, id),
				ne(bookings.status, 'cancelled')
			))
			.limit(1);

		if (otherActiveLinks.length === 0) {
			// No other active booking holds this session — cancel it
			await db.update(sessions)
				.set({ status: 'cancelled', updatedAt: new Date() })
				.where(eq(sessions.id, sessionId));
		}
	}
}

export async function deleteBooking(id: string): Promise<void> {
	// Delete sessions exclusive to this booking before deleting the booking
	const links = await db
		.select({ sessionId: bookingSessions.sessionId })
		.from(bookingSessions)
		.where(eq(bookingSessions.bookingId, id));

	for (const { sessionId } of links) {
		const otherLinks = await db
			.select({ id: bookingSessions.id })
			.from(bookingSessions)
			.where(and(eq(bookingSessions.sessionId, sessionId), ne(bookingSessions.bookingId, id)))
			.limit(1);

		if (otherLinks.length === 0) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
		}
	}

	// Deleting the booking cascades: booking_clients, booking_sessions
	await db.delete(bookings).where(eq(bookings.id, id));
}
