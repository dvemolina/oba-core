import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { listSessionsForDate } from '$lib/features/sessions/queries';
import { getDateRange, getTodayString, getWeekStart, getWeekDays, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const today = new Date();
	const todayStr = getTodayString();
	const view = (url.searchParams.get('view') ?? 'month') as 'month' | 'week' | 'day';
	const year = parseInt(url.searchParams.get('year') ?? String(today.getFullYear()));
	const month = parseInt(url.searchParams.get('month') ?? String(today.getMonth() + 1));
	const weekStart = url.searchParams.get('week') ?? todayStr;
	const dayDate = url.searchParams.get('date') ?? todayStr;

	let from: string, to: string;

	if (view === 'day') {
		from = to = dayDate;
	} else {
		({ from, to } = getDateRange(view, year, month, weekStart));
	}

	const [bookings, events, daySessions] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to),
		view === 'day' ? listSessionsForDate(dayDate) : Promise.resolve([])
	]);

	// Week view helpers
	const weekStartDate = getWeekStart(weekStart);
	const weekDays = getWeekDays(weekStartDate);
	const prevWeek = formatDate(new Date(weekStartDate.getTime() - 7 * 86400000));
	const nextWeek = formatDate(new Date(weekStartDate.getTime() + 7 * 86400000));

	// Day view helpers
	const prevDay = formatDate(new Date(new Date(dayDate + 'T00:00:00').getTime() - 86400000));
	const nextDay = formatDate(new Date(new Date(dayDate + 'T00:00:00').getTime() + 86400000));
	const dayLabel = view === 'day'
		? new Date(dayDate + 'T00:00:00').toLocaleDateString('default', {
				weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
		  })
		: '';

	return {
		bookings, events, daySessions, view, year, month,
		weekStart, weekDays, prevWeek, nextWeek,
		dayDate, prevDay, nextDay, dayLabel,
		today: todayStr
	};
};
