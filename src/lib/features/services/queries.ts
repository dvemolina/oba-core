import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, events, services } from '$lib/server/db/schema';
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
): Promise<{ deleted: boolean; reason?: 'has_bookings' | 'has_events' }> {
	const [linked] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.serviceId, id)).limit(1);
	if (linked) return { deleted: false, reason: 'has_bookings' };
	const [linkedEvent] = await db.select({ id: events.id }).from(events).where(eq(events.serviceId, id)).limit(1);
	if (linkedEvent) return { deleted: false, reason: 'has_events' };
	await db.delete(services).where(eq(services.id, id));
	return { deleted: true };
}
