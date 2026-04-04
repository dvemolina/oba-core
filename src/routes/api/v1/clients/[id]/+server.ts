import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { getBookingsForClient } from '$lib/features/bookings/queries';
import { getClient, updateClient } from '$lib/features/clients/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const client = await getClient(event.params.id);
	if (!client) return apiError('Not found', 404);
	const bookings = await getBookingsForClient(event.params.id);
	return apiResponse({ ...client, bookings });
};

export const PATCH: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		return apiResponse(await updateClient(event.params.id, body));
	} catch {
		return apiError('Invalid request body');
	}
};
