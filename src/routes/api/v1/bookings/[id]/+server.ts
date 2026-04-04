import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { cancelBooking, getBooking, updateBooking } from '$lib/features/bookings/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const booking = await getBooking(event.params.id);
	if (!booking) return apiError('Not found', 404);
	return apiResponse(booking);
};

export const PATCH: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		const booking = await updateBooking(event.params.id, body);
		return apiResponse(booking);
	} catch {
		return apiError('Invalid request body');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	await cancelBooking(event.params.id);
	return apiResponse({ cancelled: true });
};
