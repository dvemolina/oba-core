import { and, count, eq, inArray, lte, gte, ne, sql } from 'drizzle-orm';
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

	const ids = rows.map(r => r.id);
	const counts = await db
		.select({
			serviceEditionId: bookings.serviceEditionId,
			total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)`
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			and(
				inArray(bookings.serviceEditionId, ids as string[]),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled')
			)
		)
		.groupBy(bookings.serviceEditionId);

	const countByEdition: Record<string, number> = {};
	for (const c of counts) {
		if (c.serviceEditionId) countByEdition[c.serviceEditionId] = parseInt(c.total);
	}

	return rows.map(r => ({ ...r, enrolledCount: countByEdition[r.id] ?? 0 }));
}

export async function listEditionsForService(serviceId: string): Promise<ServiceEdition[]> {
	const rows = await db
		.select()
		.from(serviceEditions)
		.where(eq(serviceEditions.serviceId, serviceId))
		.orderBy(serviceEditions.startDate);

	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);

	const counts = await db
		.select({
			serviceEditionId: bookings.serviceEditionId,
			total: sql<string>`COALESCE(SUM(${bookingClients.participantCount}), 0)`
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			and(
				inArray(bookings.serviceEditionId, ids as string[]),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled')
			)
		)
		.groupBy(bookings.serviceEditionId);

	const countByEdition: Record<string, number> = {};
	for (const c of counts) {
		if (c.serviceEditionId) countByEdition[c.serviceEditionId] = parseInt(c.total);
	}

	return rows.map((r) => ({ ...r, enrolledCount: countByEdition[r.id] ?? 0 }));
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
