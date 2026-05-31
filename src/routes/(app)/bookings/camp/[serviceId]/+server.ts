import { error, redirect } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { getOrCreateCampBooking } from '$lib/features/bookings/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const service = await getService(params.serviceId);
	if (!service || !service.hasRoster) error(404, 'Camp not found');
	const booking = await getOrCreateCampBooking(service);
	redirect(302, `/bookings/${booking.id}`);
};
