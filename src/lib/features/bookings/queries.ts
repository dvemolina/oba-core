// src/lib/features/bookings/queries.ts
import { and, eq, gte, lte, desc, inArray, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, bookingClients, clients, services, instructors } from '$lib/server/db/schema';
import type { Service } from '$lib/features/services/types';
import type {
	Booking,
	BookingSummary,
	ClientBookingSummary,
	CreateBookingInput,
	UpdateBookingInput
} from './types';

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
			serviceMaxStudents: services.maxStudents,
			instructorName: instructors.name,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(instructors, eq(bookings.instructorId, instructors.id))
		.where(and(gte(bookings.date, from), lte(bookings.date, to)))
		.orderBy(bookings.date, bookings.time);

	const ids = rows.map((r) => r.id);
	const counts: Record<string, number> = {};
	const firstClientNames: Record<string, string> = {};
	if (ids.length > 0) {
		const clientRows = await db
			.select({
				bookingId: bookingClients.bookingId,
				firstName: clients.firstName,
				lastName: clients.lastName
			})
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(inArray(bookingClients.bookingId, ids));
		for (const row of clientRows) {
			counts[row.bookingId] = (counts[row.bookingId] ?? 0) + 1;
			if (!firstClientNames[row.bookingId] && row.firstName) {
				firstClientNames[row.bookingId] = row.firstName;
			}
		}
	}

	return rows.map((r) => ({
		...r,
		clientCount: counts[r.id] ?? 0,
		firstClientName: firstClientNames[r.id] ?? null
	})) as BookingSummary[];
}

export async function getBooking(id: string): Promise<Booking | undefined> {
	const [booking] = await db
		.select({
			id: bookings.id,
			serviceId: bookings.serviceId,
			serviceName: services.name,
			serviceType: services.type,
			serviceColor: services.color,
			serviceMaxStudents: services.maxStudents,
			instructorId: bookings.instructorId,
			instructorName: instructors.name,
			date: bookings.date,
			dateEnd: bookings.dateEnd,
			time: bookings.time,
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
		.leftJoin(instructors, eq(bookings.instructorId, instructors.id))
		.where(eq(bookings.id, id));

	if (!booking) return undefined;

	const bookingClientRows = await db
		.select({
			id: bookingClients.id,
			bookingId: bookingClients.bookingId,
			clientId: bookingClients.clientId,
			clientFirstName: clients.firstName,
			clientLastName: clients.lastName,
			amountDue: bookingClients.amountDue,
			amountPaid: bookingClients.amountPaid,
			paymentStatus: bookingClients.paymentStatus
		})
		.from(bookingClients)
		.leftJoin(clients, eq(bookingClients.clientId, clients.id))
		.where(eq(bookingClients.bookingId, id));

	return { ...booking, clients: bookingClientRows } as Booking;
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
			instructorId: input.instructorId,
			date: input.date,
			dateEnd: input.dateEnd,
			time: input.time,
			isFlexible: input.isFlexible,
			status: input.status ?? (input.source === 'whatsapp_bot' ? 'pending' : 'confirmed'),
			source: input.source ?? 'admin',
			spotNotes: input.spotNotes,
			notes: input.notes
		})
		.returning();

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

/** For camps: find the single booking for this service, or create it (empty, no clients yet). */
export async function getOrCreateCampBooking(service: Service): Promise<Booking> {
	if (!service.campStartDate) throw new Error('Camp service has no start date');

	const [existing] = await db
		.select({ id: bookings.id })
		.from(bookings)
		.where(and(
			eq(bookings.serviceId, service.id),
			eq(bookings.date, service.campStartDate),
			ne(bookings.status, 'cancelled')
		))
		.limit(1);

	if (existing) return (await getBooking(existing.id))!;

	const [created] = await db
		.insert(bookings)
		.values({
			serviceId: service.id,
			date: service.campStartDate,
			dateEnd: service.campEndDate ?? service.campStartDate,
			isFlexible: false,
			status: 'pending'
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
	await db
		.update(bookings)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(bookings.id, id));
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

export async function cancelBooking(id: string): Promise<void> {
	await db
		.update(bookings)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(bookings.id, id));
}
