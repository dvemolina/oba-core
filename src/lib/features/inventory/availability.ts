// src/lib/features/inventory/availability.ts
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { inventoryAllocations, inventoryItemTypes } from '$lib/server/db/schema';

export interface AvailabilityBreakdown {
	total: number;
	confirmed: number;
	pending: number;
	available: number;
}

/** Confirmed = itemId IS NOT NULL. Pending/fuzzy = itemId IS NULL. */
export async function getAvailabilityBreakdown(
	itemTypeId: string,
	date: string
): Promise<AvailabilityBreakdown> {
	const [type] = await db
		.select({ totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.id, itemTypeId));

	if (!type) return { total: 0, confirmed: 0, pending: 0, available: 0 };

	const rows = await db
		.select({
			itemId: inventoryAllocations.itemId,
			quantity: inventoryAllocations.quantity
		})
		.from(inventoryAllocations)
		.where(
			and(
				eq(inventoryAllocations.itemTypeId, itemTypeId),
				ne(inventoryAllocations.status, 'returned'),
				ne(inventoryAllocations.status, 'lost'),
				lte(inventoryAllocations.startDate, date),
				gte(
					sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
					date
				)
			)
		);

	let confirmed = 0;
	let pending = 0;
	for (const r of rows) {
		if (r.itemId) confirmed += r.quantity;
		else pending += r.quantity;
	}

	const total = type.totalPoolSize ?? 0;
	return { total, confirmed, pending, available: total - confirmed - pending };
}

/** Returns per-day breakdown for a date range (inclusive). */
export async function getAvailabilityTimeline(
	itemTypeId: string,
	fromDate: string,
	toDate: string
): Promise<Array<{ date: string } & AvailabilityBreakdown>> {
	const [type] = await db
		.select({ totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.id, itemTypeId));

	const total = type?.totalPoolSize ?? 0;

	const rows = await db
		.select({
			itemId: inventoryAllocations.itemId,
			quantity: inventoryAllocations.quantity,
			startDate: inventoryAllocations.startDate,
			endDate: inventoryAllocations.endDate
		})
		.from(inventoryAllocations)
		.where(
			and(
				eq(inventoryAllocations.itemTypeId, itemTypeId),
				ne(inventoryAllocations.status, 'returned'),
				ne(inventoryAllocations.status, 'lost'),
				lte(inventoryAllocations.startDate, toDate),
				gte(
					sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
					fromDate
				)
			)
		);

	const dates: string[] = [];
	const cur = new Date(fromDate + 'T00:00:00');
	const end = new Date(toDate + 'T00:00:00');
	while (cur <= end) {
		dates.push(cur.toISOString().slice(0, 10));
		cur.setDate(cur.getDate() + 1);
	}

	return dates.map((date) => {
		let confirmed = 0;
		let pending = 0;
		for (const r of rows) {
			const endD = r.endDate ?? r.startDate;
			if (r.startDate <= date && endD >= date) {
				if (r.itemId) confirmed += r.quantity;
				else pending += r.quantity;
			}
		}
		return { date, total, confirmed, pending, available: total - confirmed - pending };
	});
}

/** Returns item type IDs where available < 0 on the given date. */
export async function getInventoryShortagesForDate(date: string): Promise<string[]> {
	const types = await db
		.select({ id: inventoryItemTypes.id, totalPoolSize: inventoryItemTypes.totalPoolSize })
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.active, true));

	const poolTypes = types.filter((t) => t.totalPoolSize != null && t.totalPoolSize > 0);
	const shortages: string[] = [];

	for (const type of poolTypes) {
		const breakdown = await getAvailabilityBreakdown(type.id, date);
		if (breakdown.available < 0) shortages.push(type.id);
	}

	return shortages;
}
