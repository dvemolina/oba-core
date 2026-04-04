import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createInstructor, listInstructors } from '$lib/features/instructors/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listInstructors());
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createInstructor(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
