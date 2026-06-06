import type { InventoryAllocationWithDetails, CreateAllocationInput } from '$lib/features/inventory/types';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface BookingClient {
	id: string;
	bookingId: string;
	clientId: string;
	clientFirstName: string;
	clientLastName: string;
	clientPhone: string | null;
	clientEmail: string | null;
	status: 'enrolled' | 'cancelled';
	amountDue: string;
	amountPaid: string;
	paymentStatus: PaymentStatus;
	cancelledAt: Date | null;
}

export interface BookingParticipant {
	id: string;
	bookingId: string;
	name: string;
	notes: string | null;
	sortOrder: number;
	createdAt: Date;
}

export type BookingSource = 'admin' | 'whatsapp_bot';

export interface Booking {
	id: string;
	serviceId: string | null;
	serviceName: string | null;
	serviceType: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceHasRoster: boolean;
	serviceHasDateRange: boolean;
	serviceMaxCapacity: number | null;
	// Instructor for non-session services (rentals, products, accommodation) only
	instructorId: string | null;
	instructorName: string | null;
	participantCount: number | null;
	allocations: InventoryAllocationWithDetails[];
	date: string;
	dateEnd: string | null;
	serviceRunId: string | null;
	serviceRunStartDate: string | null;
	serviceRunEndDate: string | null;
	time: string | null;
	sessionsIncluded: number | null;
	isFlexible: boolean;
	status: BookingStatus;
	source: BookingSource;
	spotNotes: string | null;
	notes: string | null;
	priceOverride: string | null;
	serviceBasePrice: string | null;
	clients: BookingClient[];
	participants: BookingParticipant[];
	createdAt: Date;
	updatedAt: Date;
}

export interface BookingSummary {
	id: string;
	serviceName: string | null;
	serviceType: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceHasRoster: boolean;
	serviceHasDateRange: boolean;
	serviceHasInventoryUnits: boolean;
	serviceRequiresInstructor: boolean;
	serviceMaxCapacity: number | null;
	// Instructor for non-session services only
	instructorId: string | null;
	instructorName: string | null;
	allocationSummary: string | null;
	date: string;
	dateEnd: string | null;
	serviceRunId: string | null;
	serviceRunStartDate: string | null;
	serviceRunEndDate: string | null;
	time: string | null;
	sessionsIncluded: number | null;
	isFlexible: boolean;
	status: BookingStatus;
	clientCount: number;
	firstClientName: string | null;
}

/** Extended summary used in the /bookings list page. */
export interface BookingListItem extends BookingSummary {
	sessionCount: number;
	scheduledCount: number;
}

export interface ClientBookingSummary {
	id: string;
	date: string;
	time: string | null;
	serviceName: string | null;
	status: BookingStatus;
}

export interface CreateBookingInput {
	serviceId: string;
	/** For non-session services (rentals, products, accommodation) only */
	instructorId?: string;
	allocations?: CreateAllocationInput[];
	participantCount?: number;
	date: string;
	dateEnd?: string;
	serviceRunId?: string;
	/** For non-session services only */
	time?: string;
	sessionsIncluded?: number;
	isFlexible: boolean;
	status?: BookingStatus;
	source?: BookingSource;
	spotNotes?: string;
	notes?: string;
	clients: {
		clientId: string;
		amountDue: string;
	}[];
}

export interface UpdateBookingInput {
	/** For non-session services only */
	instructorId?: string | null;
	date?: string;
	dateEnd?: string | null;
	/** For non-session services only */
	time?: string | null;
	sessionsIncluded?: number | null;
	isFlexible?: boolean;
	status?: BookingStatus;
	spotNotes?: string | null;
	notes?: string | null;
	priceOverride?: string | null;
}
