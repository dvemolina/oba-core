export type SessionStatus = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';

export interface SessionInstructor {
	id: string;
	sessionId: string;
	instructorId: string;
	instructorName: string | null;
}

// Pure session row — no booking context. bookingId is NOT stored on the session itself;
// the relationship lives in the booking_sessions junction table.
export interface Session {
	id: string;
	date: string;
	time: string | null;            // null = unscheduled
	durationMinutes: number | null; // null = use service default
	notes: string | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	createdAt: Date;
	updatedAt: Date;
}

// Session enriched with booking context for the calendar day view.
export interface SessionForDay extends Session {
	// Primary booking used for navigation (first linked booking).
	// Populated from the booking_sessions junction.
	bookingId: string;
	bookingIds: string[];        // all linked booking IDs
	bookingStatus: string;       // primary booking status (for conflict display)
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceDurationMinutes: number | null;  // service-level default duration
	effectiveDuration: number;              // session override ?? service default ?? 60
	// Aggregated across all linked bookings for this session
	clientNames: string[];
	totalClients: number;
}

// Session enriched for the Agenda view.
export interface AgendaSession extends Session {
	// Primary booking for navigation (first linked booking).
	bookingId: string;
	bookingIds: string[];
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasRoster: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;              // session override ?? service default ?? 60
	sessionsIncluded: number | null;
	bookingStatus: string;
	bookingDate: string;
	bookingDateEnd: string | null;
	isFlexible: boolean;
	// For lessons (non-roster): first client details
	clientName: string | null;
	clientPhone: string | null;
	// For camps (roster): enrollment aggregate
	enrolledCount: number;
	maxCapacity: number | null;
}

export interface CreateSessionInput {
	bookingId: string;          // creates the booking_sessions link automatically
	date: string;
	time?: string;
	durationMinutes?: number;
	notes?: string;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	durationMinutes?: number | null;
	notes?: string | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}
