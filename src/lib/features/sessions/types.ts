import type { ServiceModules } from '$lib/features/services/modules';

export type SessionStatus    = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled';
export type SkillLevel       = 'beginner' | 'intermediate' | 'advanced';
export type SessionOwnerType = 'booking' | 'service' | 'edition';

export type SessionContext =
	| { type: 'booking'; bookingId: string }
	| { type: 'service'; serviceId: string; date: string }
	| { type: 'edition'; editionId: string }

// Minimal shape needed by resolveSessionContext — full Booking satisfies this structurally
export interface BookingSessionContext {
	id: string;
	date: string;
	serviceId: string | null;
	serviceEditionId: string | null;
	serviceModules: ServiceModules | null;
}

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
	bookingParticipantId: string | null;
	notes: string | null;
	sortOrder: number;
}

export interface Session {
	id: string;
	ownerType: SessionOwnerType;
	bookingId: string | null;         // set when ownerType='booking'
	serviceId: string | null;         // set when ownerType='service'
	serviceEditionId: string | null;  // set when ownerType='edition'
	date: string;
	time: string | null;
	durationMinutes: number | null;
	notes: string | null;
	skillLevel: SkillLevel | null;
	status: SessionStatus;
	sortOrder: number;
	instructors: SessionInstructor[];
	participants: SessionParticipant[];
	createdAt: Date;
	updatedAt: Date;
}

// Calendar day view — enriched with booking/service context
export interface SessionForDay extends Session {
	primaryBookingId: string | null;  // null for edition sessions
	bookingIds: string[];
	editionId: string | null;
	bookingStatus: string | null;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	participantNames: string[];
	totalParticipants: number;
	totalAmountDue: number;
	totalAmountPaid: number;
}

// Agenda view — enriched with full booking/client context
export interface AgendaSession extends Session {
	primaryBookingId: string | null;
	bookingIds: string[];
	editionId: string | null;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasRoster: boolean;
	serviceDurationMinutes: number | null;
	effectiveDuration: number;
	sessionsIncluded: number | null;
	bookingStatus: string | null;
	bookingDate: string;
	bookingDateEnd: string | null;
	isFlexible: boolean;
	firstClientName: string | null;
	participantNames: string[];
	totalParticipants: number;
	enrolledCount: number;
	maxCapacity: number | null;
	totalAmountDue: number;
	totalAmountPaid: number;
}

// Discriminated union — ownerType drives which FK is set
export type CreateSessionInput =
	| ({ ownerType: 'booking'; bookingId: string } & BaseSessionInput)
	| ({ ownerType: 'service'; serviceId: string } & BaseSessionInput)
	| ({ ownerType: 'edition'; editionId: string } & BaseSessionInput)

export interface BaseSessionInput {
	date: string;
	time?: string;
	durationMinutes?: number;
	notes?: string;
	skillLevel?: SkillLevel;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface UpdateSessionInput {
	date?: string;
	time?: string | null;
	durationMinutes?: number | null;
	notes?: string | null;
	skillLevel?: SkillLevel | null;
	status?: SessionStatus;
	instructorIds?: string[];
	sortOrder?: number;
}

export interface CreateParticipantInput {
	sessionId: string;
	name: string;
	bookingParticipantId?: string;
	notes?: string;
	sortOrder?: number;
}

export interface BulkGenOptions {
	sessionsPerDay: number;
	times: (string | undefined)[];
	weekdaysOnly: boolean;
	durationMinutes?: number;
	clearExisting: boolean;
}

// Type guards
export const isBookingSession  = (s: Session): s is Session & { bookingId: string }        => s.ownerType === 'booking';
export const isServiceSession  = (s: Session): s is Session & { serviceId: string }        => s.ownerType === 'service';
export const isEditionSession  = (s: Session): s is Session & { serviceEditionId: string } => s.ownerType === 'edition';

export interface BookingEnrollment {
	bookingId: string;
	clientId: string;
	firstName: string | null;
	lastName: string | null;
	amountDue: string;
	amountPaid: string;
	status: 'enrolled' | 'cancelled';
}
