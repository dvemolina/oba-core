import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { updateSession, deleteSession } from '$lib/features/whatsapp/queries';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		const session = await updateSession(event.params.id, {
			state: body.state,
			serviceType: body.service_type,
			collectedData: body.collected_data,
			reservationId: body.reservation_id,
			language: body.language
		});
		if (!session) return apiError('Session not found', 404);
		return apiResponse(session);
	} catch {
		return apiError('Invalid request body');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	await deleteSession(event.params.id);
	return apiResponse({ deleted: true });
};
