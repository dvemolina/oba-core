import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createClient, listClients } from '$lib/features/clients/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const search = event.url.searchParams.get('q') ?? undefined;
	return apiResponse(await listClients(search));
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		return apiResponse(await createClient(body), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
