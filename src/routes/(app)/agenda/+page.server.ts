import { eq, ne, sum, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingClients, bookings } from '$lib/server/db/schema';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listSessionsForDateRange } from '$lib/features/sessions/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { getTodayString, formatDate } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

async function loadStats(today: string) {
	// Pending revenue: sum(amount_due - amount_paid) across enrolled clients on non-cancelled bookings
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

	return {
		pendingRevenue: parseFloat(revenueRow?.pendingRevenue ?? '0') || 0
	};
}

export const load: PageServerLoad = async () => {
	const today = getTodayString();

	const past = new Date();
	past.setDate(past.getDate() - 30);
	const future = new Date();
	future.setDate(future.getDate() + 90);

	const from = formatDate(past);
	const to = formatDate(future);

	const [sessions, bookings, events, stats] = await Promise.all([
		listSessionsForDateRange(from, to),
		listBookingsForDateRange(from, to),
		listEventsForDateRange(today, to),
		loadStats(today)
	]);

	const activeCamps = bookings.filter(
		b => b.serviceHasRoster && b.dateEnd && b.status !== 'cancelled' && b.dateEnd >= today
	);
	const campIds = new Set(activeCamps.map(c => c.id));

	// Exclude camps (already shown in the banner) and session-based services
	const nonSessionBookings = bookings.filter(
		b => !b.serviceHasSessions && b.status !== 'cancelled' && !campIds.has(b.id)
	);

	// Stats derived from loaded data
	const todaySessions = sessions.filter(s => s.date === today);
	const scheduledToday = todaySessions.filter(s => s.status === 'scheduled').length;
	const unscheduledTotal = sessions.filter(s => s.status === 'unscheduled' && s.date >= today).length;

	return {
		sessions, nonSessionBookings, activeCamps, events, today,
		stats: {
			scheduledToday,
			unscheduledTotal,
			pendingRevenue: stats.pendingRevenue
		}
	};
};
