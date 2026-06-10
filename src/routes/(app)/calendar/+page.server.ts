import { fail } from '@sveltejs/kit';
import { isInstructorRole } from '$lib/server/permissions';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { listSessionsForDate, listSessionsForDateRange, updateSession } from '$lib/features/sessions/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { getDateRange, getTodayString, getWeekStart, getWeekDays, formatDate } from '$lib/features/calendar/utils';
import { getInventoryShortagesForDate } from '$lib/features/inventory/availability';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
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

	let instructorId: string | undefined;
	if (isInstructorRole(locals)) {
		instructorId = locals.user!.id;
	}

	const [bookings, events, daySessions, rangedSessions, instructorList] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to),
		view === 'day' ? listSessionsForDate(dayDate, instructorId) : Promise.resolve([]),
		view !== 'day' ? listSessionsForDateRange(from, to, instructorId) : Promise.resolve([]),
		view === 'day' ? listInstructors() : Promise.resolve([])
	]);

	// Week view helpers
	const weekStartDate = getWeekStart(weekStart);
	const weekDays = getWeekDays(weekStartDate);
	const prevWeek = formatDate(new Date(weekStartDate.getTime() - 7 * 86400000));
	const nextWeek = formatDate(new Date(weekStartDate.getTime() + 7 * 86400000));

	const inventoryShortages = view === 'day'
		? await getInventoryShortagesForDate(dayDate)
		: [];

	// Day view helpers
	const prevDay = formatDate(new Date(new Date(dayDate + 'T00:00:00').getTime() - 86400000));
	const nextDay = formatDate(new Date(new Date(dayDate + 'T00:00:00').getTime() + 86400000));
	const dayLabel = view === 'day'
		? new Date(dayDate + 'T00:00:00').toLocaleDateString('default', {
				weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
		  })
		: '';

	return {
		bookings, events, daySessions, rangedSessions, instructors: instructorList, view, year, month,
		weekStart, weekDays, prevWeek, nextWeek,
		dayDate, prevDay, nextDay, dayLabel,
		today: todayStr,
		inventoryShortages
	};
};

export const actions: Actions = {
	assignSession: async ({ request }) => {
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		const time = form.get('time')?.toString() || null;
		const durRaw = form.get('duration')?.toString();
		const durationMinutes = durRaw ? parseInt(durRaw) : null;
		const notes = form.get('notes')?.toString() || null;
		const instructorIds = form.getAll('instructorId').map(String).filter(Boolean);
		await updateSession(sessionId, { time, durationMinutes, notes, instructorIds });
		return { ok: true };
	}
};
