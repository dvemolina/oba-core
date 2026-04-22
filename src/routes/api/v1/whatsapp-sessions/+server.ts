import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { getSession, listSessionsByState, upsertSession } from '$lib/features/whatsapp/queries';
import type { WhatsappSessionState } from '$lib/features/whatsapp/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const whatsappId = event.url.searchParams.get('whatsapp_id');
	const state = event.url.searchParams.get('state') as WhatsappSessionState | null;

	if (whatsappId) {
		const session = await getSession(whatsappId);
		return apiResponse(session ?? null);
	}

	if (state) {
		const sessions = await listSessionsByState(state);
		return apiResponse(sessions);
	}

	return apiError('whatsapp_id or state param required', 400);
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		if (!body.whatsapp_id) return apiError('whatsapp_id is required', 400);

		const session = await upsertSession({
			whatsappId: body.whatsapp_id,
			state: body.state,
			serviceType: body.service_type,
			collectedData: body.collected_data,
			reservationId: body.reservation_id,
			language: body.language
		});
		return apiResponse(session, 201);
	} catch {
		return apiError('Invalid request body');
	}
};
