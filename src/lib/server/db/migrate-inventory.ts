// src/lib/server/db/migrate-inventory.ts
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { eq, isNotNull } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function main() {
	console.log('Starting inventory migration...');

	// 1. Read existing accommodation unit types
	const oldTypes = await db.select().from(schema.accommodationUnitTypes);
	console.log(`Found ${oldTypes.length} accommodation unit types`);

	// Map: old unitType.id → new inventoryItemType.id
	const typeIdMap: Record<string, string> = {};

	for (const old of oldTypes) {
		const [created] = await db
			.insert(schema.inventoryItemTypes)
			.values({
				name: old.name,
				description: old.description,
				trackingMode: 'specific',
				totalPoolSize: null,
				attributeSchema: {},
				unitPrice: old.pricePerNight,
				pricingUnit: 'per_night',
				capacity: old.maxOccupancy,
				active: old.active
			})
			.returning();
		typeIdMap[old.id] = created.id;
		console.log(`  Migrated type "${old.name}" → ${created.id}`);
	}

	// 2. Read existing accommodation units → inventory items
	const oldUnits = await db.select().from(schema.accommodationUnits);
	console.log(`Found ${oldUnits.length} accommodation units`);

	// Map: old unit.id → new inventoryItem.id
	const unitIdMap: Record<string, string> = {};

	for (const unit of oldUnits) {
		const newTypeId = typeIdMap[unit.unitTypeId];
		if (!newTypeId) {
			console.warn(`  Skipping unit ${unit.id} — parent type not migrated`);
			continue;
		}
		const status = unit.status === 'maintenance' ? 'maintenance' as const : 'available' as const;
		const [created] = await db
			.insert(schema.inventoryItems)
			.values({
				itemTypeId: newTypeId,
				name: unit.name,
				attributes: {},
				status,
				sortOrder: unit.sortOrder
			})
			.returning();
		unitIdMap[unit.id] = created.id;
		console.log(`  Migrated unit "${unit.name}" → ${created.id}`);
	}

	// 3. For each service with hasInventoryUnits, create service_inventory_links
	const services = await db
		.select()
		.from(schema.services)
		.where(eq(schema.services.hasInventoryUnits, true));

	for (const svc of services) {
		const typesForService = oldTypes.filter((t) => t.serviceId === svc.id);
		for (const oldType of typesForService) {
			const newTypeId = typeIdMap[oldType.id];
			if (!newTypeId) continue;
			try {
				await db.insert(schema.serviceInventoryLinks).values({
					serviceId: svc.id,
					itemTypeId: newTypeId,
					quantityPerBooking: 1,
					isIncluded: true,
					priceOverride: null
				});
				console.log(`  Linked service "${svc.name}" → type "${oldType.name}"`);
			} catch (e: any) {
				// Unique constraint violation means the link already exists (idempotent)
				if (e?.code === '23505') {
					console.log(`  Link already exists: service "${svc.name}" → type "${oldType.name}" (skipped)`);
				} else {
					throw e;
				}
			}
		}
	}

	// 4. Migrate bookings: create inventoryAllocations for bookings with accommodationUnitId
	const allBookings = await db.select().from(schema.bookings);
	const bookedUnits = allBookings.filter((b) => b.accommodationUnitId != null);
	console.log(`Found ${bookedUnits.length} bookings with accommodation unit`);

	for (const booking of bookedUnits) {
		const newItemId = unitIdMap[booking.accommodationUnitId!];
		if (!newItemId) {
			console.warn(`  Skipping booking ${booking.id} — unit ${booking.accommodationUnitId} not migrated`);
			continue;
		}
		// Get the itemTypeId from the new inventory item
		const [item] = await db
			.select()
			.from(schema.inventoryItems)
			.where(eq(schema.inventoryItems.id, newItemId));
		if (!item) continue;

		await db.insert(schema.inventoryAllocations).values({
			bookingId: booking.id,
			itemTypeId: item.itemTypeId,
			itemId: newItemId,
			quantity: booking.guestsCount ?? 1,
			attributeFilter: null,
			startDate: booking.date,
			endDate: booking.dateEnd,
			status: booking.status === 'cancelled' ? 'returned' : 'allocated'
		});
		console.log(`  Migrated booking ${booking.id} → allocation`);
	}

	console.log('\nMigration complete!');
	await client.end();
}

main().catch((e) => {
	console.error('Migration failed:', e);
	process.exit(1);
});
