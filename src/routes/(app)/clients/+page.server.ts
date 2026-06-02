import { listClients } from '$lib/features/clients/queries';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const search = url.searchParams.get('q') ?? undefined;
	const clients = await listClients(search);
	return { clients, search };
};
