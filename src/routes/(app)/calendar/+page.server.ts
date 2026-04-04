import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { getDateRange, getTodayString } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const view = (url.searchParams.get('view') ?? 'month') as 'agenda' | 'month';
	const today = new Date();
	const year = parseInt(url.searchParams.get('year') ?? String(today.getFullYear()));
	const month = parseInt(url.searchParams.get('month') ?? String(today.getMonth() + 1));

	const { from, to } = getDateRange(view, year, month);
	const [bookings, events] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to)
	]);

	return { bookings, events, view, year, month, today: getTodayString() };
};
