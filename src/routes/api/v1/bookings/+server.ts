import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { listBookingsForDateRange, createBooking } from '$lib/features/bookings/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const from = event.url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
	const to = event.url.searchParams.get('to') ?? from;

	const bookings = await listBookingsForDateRange(from, to);
	return apiResponse(bookings);
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		const booking = await createBooking(body);
		return apiResponse(booking, 201);
	} catch {
		return apiError('Invalid request body');
	}
};
