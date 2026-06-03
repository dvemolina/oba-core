export interface ServiceRun {
	id: string;
	serviceId: string;
	startDate: string;
	endDate: string;
	maxCapacity: number | null;
	notes: string | null;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
	enrolledCount: number;
}

export interface CreateServiceRunInput {
	startDate: string;
	endDate: string;
	maxCapacity?: number | null;
	notes?: string | null;
}

export interface UpdateServiceRunInput extends Partial<CreateServiceRunInput> {
	active?: boolean;
}
