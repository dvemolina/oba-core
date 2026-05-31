import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { getTodayString, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const today = new Date();
	const future = new Date(today);
	future.setDate(future.getDate() + 90);
	const from = getTodayString();
	const to = formatDate(future);

	const [bookings, events] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to)
	]);

	return { bookings, events, today: getTodayString() };
};
