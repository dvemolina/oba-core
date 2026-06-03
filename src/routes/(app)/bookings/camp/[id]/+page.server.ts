import { error } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { listRunsForService } from '$lib/features/services/runs.queries';
import { listBookingsForRun } from '$lib/features/bookings/queries';
import { requireRole } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const runs = await listRunsForService(params.id);
	const focusRunId = url.searchParams.get('run') ?? runs[0]?.id ?? null;

	const bookingsByRun: Record<string, Awaited<ReturnType<typeof listBookingsForRun>>> = {};
	await Promise.all(
		runs.map(async run => {
			bookingsByRun[run.id] = await listBookingsForRun(run.id);
		})
	);

	return { service, runs, focusRunId, bookingsByRun };
};
