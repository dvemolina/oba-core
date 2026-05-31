export type SessionStatus = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';

export interface Session {
	id: string;
	bookingId: string;
	date: string;
	time: string | null;        // null = unscheduled
	notes: string | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	createdAt: Date;
	updatedAt: Date;
}

export interface SessionInstructor {
	id: string;
	sessionId: string;
	instructorId: string;
	instructorName: string | null;
}

export interface CreateSessionInput {
	bookingId: string;
	date: string;
	time?: string;
	notes?: string;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	notes?: string | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}
