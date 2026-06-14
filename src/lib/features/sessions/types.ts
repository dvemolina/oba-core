export type SessionStatus = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';

export interface SessionInstructor {
	id: string;
	sessionId: string;
	instructorId: string;
	instructorName: string | null;
}

export interface SessionParticipant {
	id: string;
	sessionId: string;
	name: string;
	notes: string | null;
	sortOrder: number;
}

// Pure session row — no booking context.
export interface Session {
	id: string;
	date: string;
	time: string | null;
	durationMinutes: number | null;
	notes: string | null;
	skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	participants: SessionParticipant[];
	createdAt: Date;
	updatedAt: Date;
}

// Session enriched with booking context for the calendar day view.
export interface SessionForDay extends Session {
	bookingId: string;
	bookingIds: string[];
	bookingStatus: string;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	// Who attends: from session_participants if set, otherwise booking client names
	participantNames: string[];
	totalParticipants: number;
	// Payment totals across all enrolled clients for this session's bookings
	totalAmountDue: number;
	totalAmountPaid: number;
}

// Session enriched for the Today/Agenda view.
export interface AgendaSession extends Session {
	bookingId: string;
	bookingIds: string[];
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasRoster: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	sessionsIncluded: number | null;
	bookingStatus: string;
	bookingDate: string;
	bookingDateEnd: string | null;
	isFlexible: boolean;
	// First enrolled client name (for card title — "[Service] · [Client]")
	firstClientName: string | null;
	// Who attends: from session_participants if set, otherwise first booking client
	participantNames: string[];
	// Total participant count across all enrolled clients
	totalParticipants: number;
	// For camps (roster): enrollment aggregate
	enrolledCount: number;
	maxCapacity: number | null;
	// Payment totals across all enrolled clients
	totalAmountDue: number;
	totalAmountPaid: number;
}

export interface CreateSessionInput {
	bookingId: string;
	date: string;
	time?: string;
	durationMinutes?: number;
	notes?: string;
	skillLevel?: 'beginner' | 'intermediate' | 'advanced';
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	durationMinutes?: number | null;
	notes?: string | null;
	skillLevel?: 'beginner' | 'intermediate' | 'advanced' | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface CreateParticipantInput {
	sessionId: string;
	name: string;
	notes?: string;
	sortOrder?: number;
}
