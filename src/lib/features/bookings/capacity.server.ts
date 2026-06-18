import {
	countEnrolledForEditionOverlap,
	getServiceEdition
} from '$lib/features/services/editions.queries';
import type { Booking, BookingClient } from './types';

type BookingCapacityInput = Pick<
	Booking,
	| 'serviceHasRoster'
	| 'serviceId'
	| 'serviceEditionId'
	| 'serviceEditionStartDate'
	| 'serviceEditionEndDate'
	| 'serviceEditionMaxCapacity'
	| 'serviceMaxCapacity'
	| 'clients'
>;

type BookingClientCapacityInput = Pick<BookingClient, 'status' | 'participantCount'>;

export interface BookingCapacitySnapshot {
	scope: 'none' | 'booking' | 'edition';
	activeCount: number;
	maxCapacity: number | null;
	slotsLeft: number | null;
}

export function countActiveBookingParticipants(clients: BookingClientCapacityInput[]): number {
	return clients
		.filter((client) => client.status !== 'cancelled')
		.reduce((sum, client) => sum + (client.participantCount ?? 1), 0);
}

export async function getBookingCapacitySnapshot(
	booking: BookingCapacityInput
): Promise<BookingCapacitySnapshot> {
	if (!booking.serviceHasRoster) {
		return { scope: 'none', activeCount: 0, maxCapacity: null, slotsLeft: null };
	}

	if (
		booking.serviceEditionId &&
		booking.serviceId &&
		booking.serviceEditionStartDate &&
		booking.serviceEditionEndDate
	) {
		const [edition, activeCount] = await Promise.all([
			getServiceEdition(booking.serviceEditionId),
			countEnrolledForEditionOverlap(
				booking.serviceId,
				booking.serviceEditionStartDate,
				booking.serviceEditionEndDate
			)
		]);
		const maxCapacity =
			edition?.maxCapacity ?? booking.serviceEditionMaxCapacity ?? booking.serviceMaxCapacity;

		return {
			scope: 'edition',
			activeCount,
			maxCapacity,
			slotsLeft: maxCapacity != null ? maxCapacity - activeCount : null
		};
	}

	const activeCount = countActiveBookingParticipants(booking.clients);
	const maxCapacity = booking.serviceMaxCapacity;

	return {
		scope: 'booking',
		activeCount,
		maxCapacity,
		slotsLeft: maxCapacity != null ? maxCapacity - activeCount : null
	};
}

export async function assertBookingHasCapacity(
	booking: BookingCapacityInput,
	delta = 1
): Promise<void> {
	if (delta <= 0) return;

	const snapshot = await getBookingCapacitySnapshot(booking);
	if (snapshot.maxCapacity == null) return;
	if (snapshot.activeCount + delta > snapshot.maxCapacity) {
		throw new Error('Capacity exceeded');
	}
}
