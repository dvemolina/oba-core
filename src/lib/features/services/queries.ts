import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, bookingClients, events, services } from '$lib/server/db/schema';
import type { CreateServiceInput, Service, UpdateServiceInput } from './types';

export async function listServices(includeInactive = false): Promise<Service[]> {
	const rows = await db
		.select()
		.from(services)
		.where(includeInactive ? undefined : eq(services.active, true))
		.orderBy(services.type, services.name);
	return rows as Service[];
}

export async function getService(id: string): Promise<Service | undefined> {
	const [row] = await db.select().from(services).where(eq(services.id, id));
	return row as Service | undefined;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
	const [row] = await db.insert(services).values(input).returning();
	return row as Service;
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
	const [row] = await db
		.update(services)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(services.id, id))
		.returning();
	return row as Service;
}

export async function deleteService(
	id: string
): Promise<{ deleted: boolean; reason?: 'has_future_bookings' | 'has_events' }> {
	const today = new Date().toISOString().slice(0, 10);

	// Block only if future bookings have actual enrolled clients (not empty auto-created roster bookings)
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
		.where(and(eq(bookings.serviceId, id), gte(bookings.date, today)))
		.limit(1);
	if (futureBookingWithClients) return { deleted: false, reason: 'has_future_bookings' };

	const [linkedEvent] = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.serviceId, id), isNotNull(events.serviceId)))
		.limit(1);
	if (linkedEvent) return { deleted: false, reason: 'has_events' };

	// Delete empty future bookings (e.g. auto-created camp roster with no enrolled clients)
	await db.delete(bookings).where(and(eq(bookings.serviceId, id), gte(bookings.date, today)));
	// Nullify service reference on past bookings to preserve history
	await db.update(bookings).set({ serviceId: null }).where(eq(bookings.serviceId, id));
	await db.delete(services).where(eq(services.id, id));
	return { deleted: true };
}
