import { listServices } from '$lib/features/services/queries';
import { listRunsForService } from '$lib/features/services/runs.queries';
import type { ServiceRun } from '$lib/features/services/runs.types';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const services = await listServices(true); // include inactive for management
	const runsByService: Record<string, ServiceRun[]> = {};
	await Promise.all(
		services
			.filter(s => s.hasDateRange)
			.map(async s => {
				runsByService[s.id] = await listRunsForService(s.id);
			})
	);
	return { services, runsByService };
};
