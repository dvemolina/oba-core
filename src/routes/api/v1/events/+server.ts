import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createEvent, listEventsForDateRange } from '$lib/features/events/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	const from = event.url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
	const to = event.url.searchParams.get('to') ?? from;
	return apiResponse(await listEventsForDateRange(from, to));
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createEvent(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
