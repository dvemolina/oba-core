export type ServiceType = 'lesson' | 'camp' | 'product' | 'rental' | 'accommodation';

export interface Service {
	id: string;
	name: string;
	description: string | null;
	type: ServiceType;
	durationMinutes: number | null;
	basePrice: string; // Drizzle returns numeric as string
	campStartDate: string | null;
	campEndDate: string | null;
	maxStudents: number | null;
	campInstructorIds: string[] | null;
	color: string;
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
	campStartDate?: string;
	campEndDate?: string;
	maxStudents?: number;
	campInstructorIds?: string[];
	color?: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
