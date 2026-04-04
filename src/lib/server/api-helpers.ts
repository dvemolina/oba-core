import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export function apiResponse<T>(data: T, status = 200) {
	return json({ data, error: null, meta: {} }, { status });
}

export function apiError(message: string, status = 400) {
	return json({ data: null, error: message, meta: {} }, { status });
}

export function requireAuth(event: RequestEvent) {
	if (!event.locals.user) {
		return apiError('Unauthorized', 401);
	}
	return null;
}
