export type ServiceType = 'lesson' | 'camp' | 'product' | 'rental' | 'accommodation';

export interface Service {
	id: string;
	name: string;
	description: string | null;
	type: ServiceType;
	durationMinutes: number | null;
	basePrice: string; // Drizzle returns numeric as string
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateServiceInput {
	name: string;
	description?: string;
	type: ServiceType;
	durationMinutes?: number;
	basePrice: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
