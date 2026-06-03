import { and, eq, gte, inArray, isNotNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, bookingClients, events, services, serviceInstructors } from '$lib/server/db/schema';
import type { CreateServiceInput, Service, UpdateServiceInput } from './types';

async function attachDefaultInstructors(rows: (typeof services.$inferSelect)[]): Promise<Service[]> {
	if (rows.length === 0) return [];
	const ids = rows.map(r => r.id);
	const links = await db
		.select({ serviceId: serviceInstructors.serviceId, userId: serviceInstructors.userId })
		.from(serviceInstructors)
		.where(inArray(serviceInstructors.serviceId, ids));

	const byService: Record<string, string[]> = {};
	for (const l of links) (byService[l.serviceId] ??= []).push(l.userId);

	return rows.map(r => ({ ...r, defaultInstructorIds: byService[r.id] ?? [] }));
}

export async function listServices(includeInactive = false): Promise<Service[]> {
	const rows = await db
		.select()
		.from(services)
		.where(includeInactive ? undefined : eq(services.active, true))
		.orderBy(services.type, services.name);
	return attachDefaultInstructors(rows);
}

export async function getService(id: string): Promise<Service | undefined> {
	const [row] = await db.select().from(services).where(eq(services.id, id));
	if (!row) return undefined;
	const [result] = await attachDefaultInstructors([row]);
	return result;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
	const [row] = await db.insert(services).values(input).returning();
	return { ...row, defaultInstructorIds: [] };
}

export async function setServiceInstructors(serviceId: string, userIds: string[]): Promise<void> {
	await db.delete(serviceInstructors).where(eq(serviceInstructors.serviceId, serviceId));
	if (userIds.length > 0) {
		await db.insert(serviceInstructors).values(
			userIds.map(userId => ({ serviceId, userId }))
		);
	}
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
	const [row] = await db
		.update(services)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(services.id, id))
		.returning();
	const [result] = await attachDefaultInstructors([row]);
	return result;
}

export async function deleteService(
	id: string
): Promise<{ deleted: boolean; reason?: 'has_future_bookings' | 'has_events' }> {
	const today = new Date().toISOString().slice(0, 10);

	const [futureBookingWithClients] = await db
		.select({ id: bookings.id })
		.from(bookings)
		.innerJoin(
			bookingClients,
			and(
				eq(bookingClients.bookingId, bookings.id),
				eq(bookingClients.status, 'enrolled')
			)
		)
		.where(and(eq(bookings.serviceId, id), gte(bookings.date, today), ne(bookings.status, 'cancelled')))
		.limit(1);
	if (futureBookingWithClients) return { deleted: false, reason: 'has_future_bookings' };

	const [linkedEvent] = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.serviceId, id), isNotNull(events.serviceId)))
		.limit(1);
	if (linkedEvent) return { deleted: false, reason: 'has_events' };

	await db.delete(bookings).where(and(eq(bookings.serviceId, id), gte(bookings.date, today)));
	await db.update(bookings).set({ serviceId: null }).where(eq(bookings.serviceId, id));
	await db.delete(services).where(eq(services.id, id));
	return { deleted: true };
}
