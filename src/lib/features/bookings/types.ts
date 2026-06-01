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

export type BookingSource = 'admin' | 'whatsapp_bot';

export interface Booking {
	id: string;
	serviceId: string | null;
	serviceName: string | null;
	serviceType: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
	serviceHasRoster: boolean;
	serviceMaxCapacity: number | null;
	// Instructor for non-session services (rentals, products, accommodation) only
	instructorId: string | null;
	instructorName: string | null;
	accommodationUnitId: string | null;
	accommodationUnitName: string | null;
	accommodationUnitTypeName: string | null;
	guestsCount: number | null;
	date: string;
	dateEnd: string | null;
	time: string | null;
	sessionsIncluded: number | null;
	isFlexible: boolean;
	status: BookingStatus;
	source: BookingSource;
	spotNotes: string | null;
	notes: string | null;
	clients: BookingClient[];
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
	instructorName: string | null;
	accommodationUnitName: string | null;
	accommodationUnitTypeName: string | null;
	guestsCount: number | null;
	date: string;
	dateEnd: string | null;
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
	accommodationUnitId?: string;
	guestsCount?: number;
	date: string;
	dateEnd?: string;
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
}
