// src/lib/features/bookings/types.ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface BookingClient {
	id: string;
	bookingId: string;
	clientId: string;
	clientFirstName: string;
	clientLastName: string;
	amountDue: string;
	amountPaid: string;
	paymentStatus: PaymentStatus;
}

export interface Booking {
	id: string;
	serviceId: string;
	serviceName: string;
	instructorId: string | null;
	instructorName: string | null;
	date: string;
	time: string | null;
	isFlexible: boolean;
	status: BookingStatus;
	spotNotes: string | null;
	notes: string | null;
	clients: BookingClient[];
	createdAt: Date;
	updatedAt: Date;
}

export interface BookingSummary {
	id: string;
	serviceName: string;
	instructorName: string | null;
	date: string;
	time: string | null;
	isFlexible: boolean;
	status: BookingStatus;
	clientCount: number;
}

export interface ClientBookingSummary {
	id: string;
	date: string;
	time: string | null;
	serviceName: string;
	status: BookingStatus;
}

export interface CreateBookingInput {
	serviceId: string;
	instructorId?: string;
	date: string;
	time?: string;
	isFlexible: boolean;
	spotNotes?: string;
	notes?: string;
	clients: {
		clientId: string;
		amountDue: string;
	}[];
}

export interface UpdateBookingInput {
	instructorId?: string | null;
	date?: string;
	time?: string | null;
	isFlexible?: boolean;
	status?: BookingStatus;
	spotNotes?: string | null;
	notes?: string | null;
}
