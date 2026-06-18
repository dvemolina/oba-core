import type { SessionSurface } from './types';

export type SessionDetailTarget =
	| { id: string }
	| Pick<SessionSurface, 'ownerType' | 'primaryBookingId' | 'serviceId' | 'editionId'>;

export function sessionDetailLink(session: SessionDetailTarget): string {
	if ('ownerType' in session) {
		switch (session.ownerType) {
			case 'booking':
				return `/bookings/${session.primaryBookingId}`;
			case 'service':
				return `/services/${session.serviceId}/sessions/`;
			case 'edition':
				return `/services/${session.serviceId}/roster?run=${session.editionId}`;
		}
	}

	return `/sessions/${session.id}`;
}
