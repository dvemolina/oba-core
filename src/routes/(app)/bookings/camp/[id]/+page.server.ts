import { error } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { listRunsForService } from '$lib/features/services/runs.queries';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { requireRole } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const runs = await listRunsForService(params.id);
	const focusRunId = url.searchParams.get('run') ?? runs[0]?.id ?? null;

	// Load bookings for each run — filter to only those belonging to this run
	const bookingsByRun: Record<string, Awaited<ReturnType<typeof listBookingsForDateRange>>> = {};
	await Promise.all(
		runs.map(async run => {
			const allBookings = await listBookingsForDateRange(run.startDate, run.endDate);
			bookingsByRun[run.id] = allBookings.filter(b => b.serviceRunId === run.id);
		})
	);

	return { service, runs, focusRunId, bookingsByRun };
};
