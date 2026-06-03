import { error, redirect } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { getOrCreateCampBooking } from '$lib/features/bookings/queries';
import { listRunsForService } from '$lib/features/services/runs.queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const service = await getService(params.serviceId);
	if (!service || !service.hasRoster) error(404, 'Camp not found');
	const runs = await listRunsForService(params.serviceId);
	const activeRun = runs.find((r) => r.active) ?? runs[0];
	if (!activeRun) error(404, 'No runs found for this camp');
	const booking = await getOrCreateCampBooking(params.serviceId, activeRun.startDate, activeRun.endDate);
	redirect(302, `/bookings/${booking.id}`);
};
