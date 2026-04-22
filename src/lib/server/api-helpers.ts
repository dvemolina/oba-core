import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';

export function apiResponse<T>(data: T, status = 200) {
	return json({ data, error: null, meta: {} }, { status });
}

export function apiError(message: string, status = 400) {
	return json({ data: null, error: message, meta: {} }, { status });
}

export function requireAuth(event: RequestEvent) {
	const apiKey = event.request.headers.get('X-API-Key');
	if (apiKey && env.INTERNAL_API_KEY && apiKey === env.INTERNAL_API_KEY) return null;
	if (!event.locals.user) return apiError('Unauthorized', 401);
	return null;
}
