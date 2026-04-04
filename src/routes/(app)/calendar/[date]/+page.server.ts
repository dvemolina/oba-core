import { error } from '@sveltejs/kit';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(400, 'Invalid date');

	const [bookings, events] = await Promise.all([
		listBookingsForDateRange(params.date, params.date),
		listEventsForDateRange(params.date, params.date)
	]);

	return { date: params.date, bookings, events };
};
