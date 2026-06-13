import { listServices } from '$lib/features/services/queries';
import { listEditionsForService } from '$lib/features/services/editions.queries';
import type { ServiceEdition } from '$lib/features/services/editions.types';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const services = await listServices(true); // include inactive for management
	const runsByService: Record<string, ServiceEdition[]> = {};
	await Promise.all(
		services
			.filter(s => 'editions' in (s.modules ?? {}))
			.map(async s => {
				runsByService[s.id] = await listEditionsForService(s.id);
			})
	);
	return { services, runsByService };
};
