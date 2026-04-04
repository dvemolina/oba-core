import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createService, listServices } from '$lib/features/services/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listServices());
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createService(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
