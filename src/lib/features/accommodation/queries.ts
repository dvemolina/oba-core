import { and, eq, inArray, isNotNull, lt, gt, ne, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { accommodationUnitTypes, accommodationUnits, bookings } from '$lib/server/db/schema';
import type {
	AccommodationUnit,
	AccommodationUnitType,
	AccommodationUnitTypeWithUnits,
	CreateUnitInput,
	CreateUnitTypeInput
} from './types';

export async function listUnitTypesByService(serviceId: string): Promise<AccommodationUnitTypeWithUnits[]> {
	const types = await db
		.select()
		.from(accommodationUnitTypes)
		.where(eq(accommodationUnitTypes.serviceId, serviceId))
		.orderBy(accommodationUnitTypes.createdAt);

	const units =
		types.length === 0
			? []
			: await db
					.select()
					.from(accommodationUnits)
					.where(inArray(accommodationUnits.unitTypeId, types.map((t) => t.id)))
					.orderBy(accommodationUnits.sortOrder);

	// Build lookup
	const unitsByType: Record<string, AccommodationUnit[]> = {};
	for (const u of units) {
		(unitsByType[u.unitTypeId] ??= []).push(u as AccommodationUnit);
	}

	return types.map((t) => ({
		...(t as AccommodationUnitType),
		units: (unitsByType[t.id] ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
	}));
}

export async function getUnitType(id: string): Promise<AccommodationUnitType | undefined> {
	const [row] = await db
		.select()
		.from(accommodationUnitTypes)
		.where(eq(accommodationUnitTypes.id, id));
	return row as AccommodationUnitType | undefined;
}

export async function createUnitType(
	serviceId: string,
	input: CreateUnitTypeInput
): Promise<AccommodationUnitType> {
	const [row] = await db
		.insert(accommodationUnitTypes)
		.values({ serviceId, ...input })
		.returning();
	return row as AccommodationUnitType;
}

export async function updateUnitType(
	id: string,
	input: Partial<CreateUnitTypeInput>
): Promise<AccommodationUnitType> {
	const [row] = await db
		.update(accommodationUnitTypes)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(accommodationUnitTypes.id, id))
		.returning();
	return row as AccommodationUnitType;
}

export async function deleteUnitType(id: string): Promise<void> {
	await db.delete(accommodationUnitTypes).where(eq(accommodationUnitTypes.id, id));
}

export async function listUnitsByType(unitTypeId: string): Promise<AccommodationUnit[]> {
	const rows = await db
		.select()
		.from(accommodationUnits)
		.where(eq(accommodationUnits.unitTypeId, unitTypeId))
		.orderBy(accommodationUnits.sortOrder, accommodationUnits.createdAt);
	return rows as AccommodationUnit[];
}

export async function createUnit(unitTypeId: string, input: CreateUnitInput): Promise<AccommodationUnit> {
	const [row] = await db
		.insert(accommodationUnits)
		.values({ unitTypeId, ...input })
		.returning();
	return row as AccommodationUnit;
}

export async function deleteUnit(id: string): Promise<void> {
	await db.delete(accommodationUnits).where(eq(accommodationUnits.id, id));
}

/**
 * Returns all available (non-booked, non-maintenance) units of a given type
 * for the requested date range [checkIn, checkOut).
 * Overlap condition: existing booking starts before our checkOut AND ends after our checkIn.
 */
export async function getAvailableUnits(
	unitTypeId: string,
	checkIn: string,
	checkOut: string
): Promise<AccommodationUnit[]> {
	// Subquery: unit IDs that have an overlapping non-cancelled booking
	const overlapping = db
		.select({ id: bookings.accommodationUnitId })
		.from(bookings)
		.where(
			and(
				isNotNull(bookings.accommodationUnitId),
				ne(bookings.status, 'cancelled'),
				lt(bookings.date, checkOut),
				gt(bookings.dateEnd, checkIn)
			)
		);

	const rows = await db
		.select()
		.from(accommodationUnits)
		.where(
			and(
				eq(accommodationUnits.unitTypeId, unitTypeId),
				eq(accommodationUnits.status, 'available'),
				notInArray(accommodationUnits.id, overlapping)
			)
		)
		.orderBy(accommodationUnits.sortOrder);

	return rows as AccommodationUnit[];
}

export async function getUnit(id: string): Promise<AccommodationUnit | undefined> {
	const [row] = await db.select().from(accommodationUnits).where(eq(accommodationUnits.id, id));
	return row as AccommodationUnit | undefined;
}
