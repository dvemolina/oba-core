type SessionDetailTarget =
	| { id: string }
	| {
		ownerType: 'booking' | 'service' | 'edition';
		primaryBookingId: string | null;
		serviceId: string | null;
		editionId: string | null;
	};

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
