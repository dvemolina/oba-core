export type OccupancyType = 'shared' | 'private' | 'entire';

export interface AccommodationUnitType {
	id: string;
	serviceId: string;
	name: string;
	occupancyType: OccupancyType;
	maxOccupancy: number;
	pricePerNight: string; // Drizzle returns numeric as string
	description: string | null;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface AccommodationUnit {
	id: string;
	unitTypeId: string;
	name: string;
	status: 'available' | 'maintenance';
	sortOrder: number;
	createdAt: Date;
}

export interface AccommodationUnitTypeWithUnits extends AccommodationUnitType {
	units: AccommodationUnit[];
}

export interface CreateUnitTypeInput {
	name: string;
	occupancyType: OccupancyType;
	maxOccupancy: number;
	pricePerNight: string;
	description?: string;
}

export interface CreateUnitInput {
	name: string;
	sortOrder?: number;
}
