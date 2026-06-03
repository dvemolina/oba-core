import { apiResponse, requireAuth } from '$lib/server/api-helpers';
import { listInstructors } from '$lib/features/instructors/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listInstructors());
};
