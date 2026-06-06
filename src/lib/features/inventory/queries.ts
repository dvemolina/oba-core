import { and, eq, inArray, isNotNull, lt, gt, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	inventoryItemTypes,
	inventoryItems,
	inventoryAllocations
} from '$lib/server/db/schema';
import type {
	InventoryItemType,
	InventoryItem,
	InventoryItemTypeWithItems,
	AvailabilityResult,
	CreateInventoryItemTypeInput,
	CreateInventoryItemInput,
	ItemStatus
} from './types';

export async function listInventoryItemTypes(includeInactive = false): Promise<InventoryItemType[]> {
	const rows = await db
		.select()
		.from(inventoryItemTypes)
		.where(includeInactive ? undefined : eq(inventoryItemTypes.active, true))
		.orderBy(inventoryItemTypes.name);
	return rows as InventoryItemType[];
}

export async function getInventoryItemType(id: string): Promise<InventoryItemType | undefined> {
	const [row] = await db
		.select()
		.from(inventoryItemTypes)
		.where(eq(inventoryItemTypes.id, id));
	return row as InventoryItemType | undefined;
}

export async function getInventoryItemTypeWithItems(id: string): Promise<InventoryItemTypeWithItems | undefined> {
	const type = await getInventoryItemType(id);
	if (!type) return undefined;
	const items = await listItemsByType(id);
	return { ...type, items };
}

export async function createInventoryItemType(input: CreateInventoryItemTypeInput): Promise<InventoryItemType> {
	const [row] = await db
		.insert(inventoryItemTypes)
		.values({
			name: input.name,
			description: input.description,
			trackingMode: input.trackingMode,
			totalPoolSize: input.totalPoolSize ?? null,
			attributeSchema: input.attributeSchema ?? {},
			unitPrice: input.unitPrice,
			pricingUnit: input.pricingUnit,
			capacity: input.capacity ?? null
		})
		.returning();
	return row as InventoryItemType;
}

export async function updateInventoryItemType(
	id: string,
	input: Partial<CreateInventoryItemTypeInput>
): Promise<InventoryItemType> {
	const [row] = await db
		.update(inventoryItemTypes)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(inventoryItemTypes.id, id))
		.returning();
	return row as InventoryItemType;
}

export async function toggleInventoryItemTypeActive(id: string): Promise<void> {
	const type = await getInventoryItemType(id);
	if (!type) return;
	await db
		.update(inventoryItemTypes)
		.set({ active: !type.active, updatedAt: new Date() })
		.where(eq(inventoryItemTypes.id, id));
}

export async function deleteInventoryItemType(id: string): Promise<void> {
	await db.delete(inventoryItemTypes).where(eq(inventoryItemTypes.id, id));
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function listItemsByType(itemTypeId: string): Promise<InventoryItem[]> {
	const rows = await db
		.select()
		.from(inventoryItems)
		.where(eq(inventoryItems.itemTypeId, itemTypeId))
		.orderBy(inventoryItems.sortOrder, inventoryItems.createdAt);
	return rows as InventoryItem[];
}

export async function createInventoryItem(
	itemTypeId: string,
	input: CreateInventoryItemInput
): Promise<InventoryItem> {
	const [row] = await db
		.insert(inventoryItems)
		.values({
			itemTypeId,
			name: input.name,
			attributes: input.attributes ?? {},
			notes: input.notes,
			sortOrder: input.sortOrder ?? 0
		})
		.returning();
	return row as InventoryItem;
}

export async function updateInventoryItem(
	id: string,
	input: Partial<CreateInventoryItemInput & { status: ItemStatus }>
): Promise<InventoryItem> {
	const [row] = await db
		.update(inventoryItems)
		.set(input)
		.where(eq(inventoryItems.id, id))
		.returning();
	return row as InventoryItem;
}

export async function deleteInventoryItem(id: string): Promise<void> {
	await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function checkAvailability(
	itemTypeId: string,
	startDate: string,
	endDate: string | null,
	requestedQty: number,
	attributeFilter?: Record<string, string> | null,
	excludeBookingId?: string
): Promise<AvailabilityResult> {
	const type = await getInventoryItemType(itemTypeId);
	if (!type) return { availableCount: 0, availableItems: [] };

	if (type.trackingMode === 'pool') {
		const conditions: ReturnType<typeof eq>[] = [
			eq(inventoryAllocations.itemTypeId, itemTypeId),
			ne(inventoryAllocations.status, 'returned'),
			ne(inventoryAllocations.status, 'lost')
		];

		if (endDate) {
			conditions.push(lt(inventoryAllocations.startDate, endDate) as any);
			conditions.push(
				gt(
					sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
					startDate
				) as any
			);
		} else {
			conditions.push(eq(inventoryAllocations.startDate, startDate) as any);
		}

		if (excludeBookingId) {
			conditions.push(ne(inventoryAllocations.bookingId, excludeBookingId) as any);
		}

		const [row] = await db
			.select({ total: sql<number>`COALESCE(SUM(${inventoryAllocations.quantity}), 0)` })
			.from(inventoryAllocations)
			.where(and(...conditions));

		const allocated = Number(row?.total ?? 0);
		const total = type.totalPoolSize ?? 0;
		return { availableCount: Math.max(0, total - allocated), availableItems: [] };
	}

	// Specific mode
	const overlapConditions: ReturnType<typeof eq>[] = [
		isNotNull(inventoryAllocations.itemId),
		ne(inventoryAllocations.status, 'returned'),
		ne(inventoryAllocations.status, 'lost')
	];

	if (endDate) {
		overlapConditions.push(lt(inventoryAllocations.startDate, endDate) as any);
		overlapConditions.push(
			gt(
				sql`COALESCE(${inventoryAllocations.endDate}, ${inventoryAllocations.startDate})`,
				startDate
			) as any
		);
	} else {
		overlapConditions.push(eq(inventoryAllocations.startDate, startDate) as any);
	}

	if (excludeBookingId) {
		overlapConditions.push(ne(inventoryAllocations.bookingId, excludeBookingId) as any);
	}

	const bookedItemIds = db
		.select({ id: inventoryAllocations.itemId })
		.from(inventoryAllocations)
		.where(and(...overlapConditions));

	const itemConditions: any[] = [
		eq(inventoryItems.itemTypeId, itemTypeId),
		eq(inventoryItems.status, 'available'),
		notInArray(inventoryItems.id, bookedItemIds)
	];

	if (attributeFilter && Object.keys(attributeFilter).length > 0) {
		itemConditions.push(
			sql`${inventoryItems.attributes} @> ${JSON.stringify(attributeFilter)}::jsonb`
		);
	}

	const availableItems = await db
		.select()
		.from(inventoryItems)
		.where(and(...itemConditions))
		.orderBy(inventoryItems.sortOrder);

	return {
		availableCount: availableItems.length,
		availableItems: availableItems as InventoryItem[]
	};
}
