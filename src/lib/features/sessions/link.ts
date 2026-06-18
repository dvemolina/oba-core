export function sessionDetailLink(session: {
	ownerType: 'booking' | 'service' | 'edition';
	primaryBookingId?: string | null;
	serviceId?: string | null;
	editionId?: string | null;
}): string {
	switch (session.ownerType) {
		case 'booking':  return `/bookings/${session.primaryBookingId}`;
		case 'service':  return `/services/${session.serviceId}/sessions/`;
		case 'edition':  return `/services/${session.serviceId}/roster?run=${session.editionId}`;
	}
}
