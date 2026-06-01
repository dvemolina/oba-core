import { eq, ne, sum, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingClients, bookings } from '$lib/server/db/schema';
import { listSessionsForDateRange } from '$lib/features/sessions/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { getTodayString, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

async function loadStats(today: string) {
	const [revenueRow] = await db
		.select({
			pendingRevenue: sum(
				sql`(${bookingClients.amountDue}::numeric - ${bookingClients.amountPaid}::numeric)`
			)
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(
			sql`${bookingClients.status} = 'enrolled'
			AND ${bookings.status} != 'cancelled'
			AND ${bookingClients.paymentStatus} != 'paid'`
		);
	return { pendingRevenue: parseFloat(revenueRow?.pendingRevenue ?? '0') || 0 };
}

export const load: PageServerLoad = async () => {
	const today = getTodayString();

	const past = new Date();
	past.setDate(past.getDate() - 30);
	const future = new Date();
	future.setDate(future.getDate() + 90);

	const from = formatDate(past);
	const to = formatDate(future);

	const [sessions, bookingsInRange, events, stats] = await Promise.all([
		listSessionsForDateRange(from, to),
		listBookingsForDateRange(from, to),
		listEventsForDateRange(today, to),
		loadStats(today)
	]);

	// Active camps: roster + date range + not cancelled + end in future
	const activeCamps = bookingsInRange.filter(
		b => b.serviceHasRoster && b.dateEnd && b.status !== 'cancelled' && b.dateEnd >= today
	);

	const todaySessions = sessions.filter(s => s.date === today);
	const scheduledToday = todaySessions.filter(s => s.status === 'scheduled').length;
	const unscheduledTotal = sessions.filter(s => s.status === 'unscheduled' && s.date >= today).length;

	return {
		sessions, activeCamps, events, today,
		stats: { scheduledToday, unscheduledTotal, pendingRevenue: stats.pendingRevenue }
	};
};
