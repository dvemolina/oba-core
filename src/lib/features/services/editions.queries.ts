import { and, eq, inArray, lte, gte, ne, or, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { serviceEditions, services, bookings, bookingClients } from '$lib/server/db/schema';
import type { CreateServiceEditionInput, ServiceEdition, UpdateServiceEditionInput } from './editions.types';

export interface CalendarEdition {
	id: string;
	serviceId: string;
	serviceName: string;
	serviceColor: string;
	startDate: string;
	endDate: string;
	maxCapacity: number | null;
	notes: string | null;
	enrolledCount: number;
}

export async function listEditionsForDateRange(from: string, to: string): Promise<CalendarEdition[]> {
	const rows = await db
		.select({
			id: serviceEditions.id,
			serviceId: serviceEditions.serviceId,
			serviceName: services.name,
			serviceColor: services.color,
			startDate: serviceEditions.startDate,
			endDate: serviceEditions.endDate,
			maxCapacity: serviceEditions.maxCapacity,
			notes: serviceEditions.notes
		})
		.from(serviceEditions)
		.innerJoin(services, eq(serviceEditions.serviceId, services.id))
		.where(
			and(
				lte(serviceEditions.startDate, to),
				gte(serviceEditions.endDate, from),
				eq(serviceEditions.active, true)
			)
		)
		.orderBy(serviceEditions.startDate);

	if (rows.length === 0) return [];

	// Count enrolled participants per edition:
	// match by direct serviceEditionId link OR by serviceId + date overlap (for bookings not linked to a specific edition)
	const enrolledByEdition: Record<string, number> = {};
	await Promise.all(rows.map(async (edition) => {
		const [row] = await db
			.select({ total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)` })
			.from(bookingClients)
			.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
			.where(and(
				eq(bookings.serviceId, edition.serviceId),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled'),
				// booking date range overlaps edition date range
				lte(bookings.date, edition.endDate),
				gte(sql`COALESCE(${bookings.dateEnd}, ${bookings.date})`, edition.startDate)
			));
		enrolledByEdition[edition.id] = parseInt(row?.total ?? '0');
	}));

	return rows.map(r => ({ ...r, enrolledCount: enrolledByEdition[r.id] ?? 0 }));
}

export async function listEditionsForService(serviceId: string): Promise<ServiceEdition[]> {
	const rows = await db
		.select()
		.from(serviceEditions)
		.where(eq(serviceEditions.serviceId, serviceId))
		.orderBy(serviceEditions.startDate);

	if (rows.length === 0) return [];

	// Count by service+date overlap (same logic as listEditionsForDateRange)
	// so bookings with serviceEditionId=NULL are still counted
	const enrolledByEdition: Record<string, number> = {};
	await Promise.all(rows.map(async (edition) => {
		const [row] = await db
			.select({ total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)` })
			.from(bookingClients)
			.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
			.where(and(
				eq(bookings.serviceId, edition.serviceId),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled'),
				lte(bookings.date, edition.endDate),
				gte(sql`COALESCE(${bookings.dateEnd}, ${bookings.date})`, edition.startDate)
			));
		enrolledByEdition[edition.id] = parseInt(row?.total ?? '0');
	}));

	return rows.map((r) => ({ ...r, enrolledCount: enrolledByEdition[r.id] ?? 0 }));
}

export async function getServiceEdition(id: string): Promise<ServiceEdition | undefined> {
	const [row] = await db.select().from(serviceEditions).where(eq(serviceEditions.id, id));
	if (!row) return undefined;
	return { ...row, enrolledCount: 0 };
}

export async function createServiceEdition(
	serviceId: string,
	input: CreateServiceEditionInput
): Promise<ServiceEdition> {
	const [row] = await db
		.insert(serviceEditions)
		.values({ serviceId, ...input })
		.returning();
	return { ...row, enrolledCount: 0 };
}

export async function updateServiceEdition(
	id: string,
	input: UpdateServiceEditionInput
): Promise<ServiceEdition> {
	const [row] = await db
		.update(serviceEditions)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(serviceEditions.id, id))
		.returning();
	return { ...row, enrolledCount: 0 };
}

export async function deleteServiceEdition(id: string): Promise<void> {
	await db.delete(serviceEditions).where(eq(serviceEditions.id, id));
}

/** Count total enrolled participants for a specific edition by service+date overlap.
 *  Matches the same logic used in listEditionsForDateRange / listEditionsForService
 *  so the number is consistent with what calendar chips show. */
export async function countEnrolledForEditionOverlap(
	serviceId: string,
	startDate: string,
	endDate: string
): Promise<number> {
	const [row] = await db
		.select({ total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)` })
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(and(
			eq(bookings.serviceId, serviceId),
			ne(bookings.status, 'cancelled'),
			eq(bookingClients.status, 'enrolled'),
			lte(bookings.date, endDate),
			gte(sql`COALESCE(${bookings.dateEnd}, ${bookings.date})`, startDate)
		));
	return parseInt(row?.total ?? '0');
}

export async function countEnrolledClientsForEdition(editionId: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)` })
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			and(
				eq(bookings.serviceEditionId, editionId),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled')
			)
		);
	return parseInt(row?.total ?? '0');
}
