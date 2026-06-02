import { listServices } from '$lib/features/services/queries';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const services = await listServices(true); // include inactive for management
	return { services };
};
