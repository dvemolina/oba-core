import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { inventoryAllocations, inventoryItemTypes, inventoryItems } from '$lib/server/db/schema';
import type {
	InventoryAllocation,
	InventoryAllocationWithDetails,
	CreateAllocationInput,
	AllocationStatus
} from './types';

export async function createAllocations(
	inputs: CreateAllocationInput[]
): Promise<InventoryAllocation[]> {
	if (inputs.length === 0) return [];
	const rows = await db
		.insert(inventoryAllocations)
		.values(
			inputs.map((i) => ({
				bookingId: i.bookingId,
				itemTypeId: i.itemTypeId,
				itemId: i.itemId ?? null,
				quantity: i.quantity ?? 1,
				attributeFilter: i.attributeFilter ?? null,
				startDate: i.startDate,
				endDate: i.endDate ?? null
			}))
		)
		.returning();
	return rows as InventoryAllocation[];
}

export async function listAllocationsForBooking(
	bookingId: string
): Promise<InventoryAllocationWithDetails[]> {
	const rows = await db
		.select({
			id: inventoryAllocations.id,
			bookingId: inventoryAllocations.bookingId,
			itemTypeId: inventoryAllocations.itemTypeId,
			itemId: inventoryAllocations.itemId,
			quantity: inventoryAllocations.quantity,
			attributeFilter: inventoryAllocations.attributeFilter,
			startDate: inventoryAllocations.startDate,
			endDate: inventoryAllocations.endDate,
			status: inventoryAllocations.status,
			createdAt: inventoryAllocations.createdAt,
			updatedAt: inventoryAllocations.updatedAt,
			itemTypeName: inventoryItemTypes.name,
			itemName: inventoryItems.name
		})
		.from(inventoryAllocations)
		.leftJoin(inventoryItemTypes, eq(inventoryAllocations.itemTypeId, inventoryItemTypes.id))
		.leftJoin(inventoryItems, eq(inventoryAllocations.itemId, inventoryItems.id))
		.where(eq(inventoryAllocations.bookingId, bookingId));
	return rows as InventoryAllocationWithDetails[];
}

export async function deleteAllocationsForBooking(bookingId: string): Promise<void> {
	await db
		.delete(inventoryAllocations)
		.where(eq(inventoryAllocations.bookingId, bookingId));
}

export async function updateAllocationStatus(
	id: string,
	status: AllocationStatus
): Promise<void> {
	await db
		.update(inventoryAllocations)
		.set({ status, updatedAt: new Date() })
		.where(eq(inventoryAllocations.id, id));
}
