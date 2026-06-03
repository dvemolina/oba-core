import { and, count, eq, inArray, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { serviceRuns, bookings, bookingClients } from '$lib/server/db/schema';
import type { CreateServiceRunInput, ServiceRun, UpdateServiceRunInput } from './runs.types';

export async function listRunsForService(serviceId: string): Promise<ServiceRun[]> {
	const rows = await db
		.select()
		.from(serviceRuns)
		.where(eq(serviceRuns.serviceId, serviceId))
		.orderBy(serviceRuns.startDate);

	if (rows.length === 0) return [];

	const ids = rows.map((r) => r.id);

	const counts = await db
		.select({
			serviceRunId: bookings.serviceRunId,
			total: count()
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			and(
				inArray(bookings.serviceRunId, ids as string[]),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled')
			)
		)
		.groupBy(bookings.serviceRunId);

	const countByRun: Record<string, number> = {};
	for (const c of counts) {
		if (c.serviceRunId) countByRun[c.serviceRunId] = Number(c.total);
	}

	return rows.map((r) => ({ ...r, enrolledCount: countByRun[r.id] ?? 0 }));
}

export async function getServiceRun(id: string): Promise<ServiceRun | undefined> {
	const [row] = await db.select().from(serviceRuns).where(eq(serviceRuns.id, id));
	if (!row) return undefined;
	return { ...row, enrolledCount: 0 };
}

export async function createServiceRun(
	serviceId: string,
	input: CreateServiceRunInput
): Promise<ServiceRun> {
	const [row] = await db
		.insert(serviceRuns)
		.values({ serviceId, ...input })
		.returning();
	return { ...row, enrolledCount: 0 };
}

export async function updateServiceRun(
	id: string,
	input: UpdateServiceRunInput
): Promise<ServiceRun> {
	const [row] = await db
		.update(serviceRuns)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(serviceRuns.id, id))
		.returning();
	return { ...row, enrolledCount: 0 };
}

export async function deleteServiceRun(id: string): Promise<void> {
	await db.delete(serviceRuns).where(eq(serviceRuns.id, id));
}

export async function countEnrolledClientsForRun(runId: string): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			and(
				eq(bookings.serviceRunId, runId),
				ne(bookings.status, 'cancelled'),
				eq(bookingClients.status, 'enrolled')
			)
		);
	return Number(row?.total ?? 0);
}
