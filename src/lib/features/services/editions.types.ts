export interface ServiceEdition {
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

export interface CreateServiceEditionInput {
	startDate: string;
	endDate: string;
	maxCapacity?: number | null;
	notes?: string | null;
}

export interface UpdateServiceEditionInput extends Partial<CreateServiceEditionInput> {
	active?: boolean;
}
