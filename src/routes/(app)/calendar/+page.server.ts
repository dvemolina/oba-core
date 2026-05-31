import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { getDateRange, getTodayString, getWeekStart, getWeekDays, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const view = (url.searchParams.get('view') ?? 'month') as 'month' | 'week';
	const today = new Date();
	const year = parseInt(url.searchParams.get('year') ?? String(today.getFullYear()));
	const month = parseInt(url.searchParams.get('month') ?? String(today.getMonth() + 1));
	const weekStart = url.searchParams.get('week') ?? getTodayString();

	const { from, to } = getDateRange(view, year, month, weekStart);
	const [bookings, events] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to)
	]);

	// Pre-compute week days for the week view
	const weekStartDate = getWeekStart(weekStart);
	const weekDays = getWeekDays(weekStartDate);
	const prevWeek = formatDate(new Date(weekStartDate.getTime() - 7 * 86400000));
	const nextWeek = formatDate(new Date(weekStartDate.getTime() + 7 * 86400000));

	return { bookings, events, view, year, month, weekStart, weekDays, prevWeek, nextWeek, today: getTodayString() };
};
