import { json } from '@sveltejs/kit';
import { listEditionsForService } from '$lib/features/services/editions.queries';
import { requireRole } from '$lib/server/permissions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const serviceId = url.searchParams.get('serviceId') ?? '';
	if (!serviceId) return json([]);
	const editions = await listEditionsForService(serviceId);
	return json(editions);
};
