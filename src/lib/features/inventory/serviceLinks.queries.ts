import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { serviceInventoryLinks, inventoryItemTypes } from '$lib/server/db/schema';
import type {
	ServiceInventoryLink,
	ServiceInventoryLinkWithType,
	AddServiceInventoryLinkInput
} from './types';

export async function listLinksForService(serviceId: string): Promise<ServiceInventoryLinkWithType[]> {
	const rows = await db
		.select({
			id: serviceInventoryLinks.id,
			serviceId: serviceInventoryLinks.serviceId,
			itemTypeId: serviceInventoryLinks.itemTypeId,
			quantityPerBooking: serviceInventoryLinks.quantityPerBooking,
			isIncluded: serviceInventoryLinks.isIncluded,
			priceOverride: serviceInventoryLinks.priceOverride,
			createdAt: serviceInventoryLinks.createdAt,
			itemType: {
				id: inventoryItemTypes.id,
				name: inventoryItemTypes.name,
				description: inventoryItemTypes.description,
				trackingMode: inventoryItemTypes.trackingMode,
				totalPoolSize: inventoryItemTypes.totalPoolSize,
				attributeSchema: inventoryItemTypes.attributeSchema,
				unitPrice: inventoryItemTypes.unitPrice,
				pricingUnit: inventoryItemTypes.pricingUnit,
				capacity: inventoryItemTypes.capacity,
				active: inventoryItemTypes.active,
				createdAt: inventoryItemTypes.createdAt,
				updatedAt: inventoryItemTypes.updatedAt
			}
		})
		.from(serviceInventoryLinks)
		.innerJoin(inventoryItemTypes, eq(serviceInventoryLinks.itemTypeId, inventoryItemTypes.id))
		.where(eq(serviceInventoryLinks.serviceId, serviceId))
		.orderBy(serviceInventoryLinks.createdAt);
	return rows as ServiceInventoryLinkWithType[];
}

export async function addInventoryLink(
	serviceId: string,
	input: AddServiceInventoryLinkInput
): Promise<ServiceInventoryLink> {
	const [row] = await db
		.insert(serviceInventoryLinks)
		.values({
			serviceId,
			itemTypeId: input.itemTypeId,
			quantityPerBooking: input.quantityPerBooking ?? 1,
			isIncluded: input.isIncluded ?? true,
			priceOverride: input.priceOverride ?? null
		})
		.returning();
	return row as ServiceInventoryLink;
}

export async function removeInventoryLink(id: string): Promise<void> {
	await db.delete(serviceInventoryLinks).where(eq(serviceInventoryLinks.id, id));
}

export async function updateInventoryLink(
	id: string,
	input: Partial<Pick<AddServiceInventoryLinkInput, 'quantityPerBooking' | 'isIncluded' | 'priceOverride'>>
): Promise<ServiceInventoryLink> {
	if (Object.keys(input).length === 0) throw new Error('updateInventoryLink: no fields to update');
	const [row] = await db
		.update(serviceInventoryLinks)
		.set(input)
		.where(eq(serviceInventoryLinks.id, id))
		.returning();
	if (!row) throw new Error(`ServiceInventoryLink not found: ${id}`);
	return row as ServiceInventoryLink;
}
