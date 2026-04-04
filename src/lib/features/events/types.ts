// src/lib/features/events/types.ts
export interface CalendarEvent {
	id: string;
	title: string;
	description: string | null;
	startDate: string;
	endDate: string;
	serviceId: string | null;
	price: string | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateEventInput {
	title: string;
	description?: string;
	startDate: string;
	endDate: string;
	serviceId?: string;
	price?: string;
	notes?: string;
}
