import { error } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { listEditionsForService } from '$lib/features/services/editions.queries';
import { listBookingsForRun } from '$lib/features/bookings/queries';
import { requireRole } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const editions = await listEditionsForService(params.id);
	const focusEditionId = url.searchParams.get('run') ?? editions[0]?.id ?? null;

	const bookingsByEdition: Record<string, Awaited<ReturnType<typeof listBookingsForRun>>> = {};
	await Promise.all(
		editions.map(async edition => {
			bookingsByEdition[edition.id] = await listBookingsForRun(edition.id);
		})
	);

	return { service, editions, focusEditionId, bookingsByEdition };
};
