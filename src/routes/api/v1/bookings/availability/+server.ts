import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { db } from '$lib/server/db';
import { bookings, bookingClients, services } from '$lib/server/db/schema';
import { and, eq, lte, gte, or, inArray, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const MAX_CAPACITY: Record<string, number> = {
	lesson: 6,
	accommodation: 8
};

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const dateFrom = event.url.searchParams.get('date_from');
	const dateTo = event.url.searchParams.get('date_to') ?? dateFrom;
	const serviceType = event.url.searchParams.get('service_type');

	if (!dateFrom || !serviceType) {
		return apiError('date_from and service_type are required', 400);
	}

	const matchingServices = await db
		.select({ id: services.id })
		.from(services)
		.where(and(eq(services.type, serviceType as any), eq(services.active, true)));

	if (matchingServices.length === 0) {
		return apiResponse({ available: false, capacity_used: 0, max_capacity: 0 });
	}

	const serviceIds = matchingServices.map((s) => s.id);

	// Find bookings that overlap with the requested date range
	const activeBookings = await db
		.select({ id: bookings.id })
		.from(bookings)
		.where(
			and(
				inArray(bookings.serviceId, serviceIds),
				or(eq(bookings.status, 'pending'), eq(bookings.status, 'confirmed')),
				lte(bookings.date, dateTo!),
				or(
					gte(bookings.dateEnd, dateFrom),
					and(isNull(bookings.dateEnd), gte(bookings.date, dateFrom))
				)
			)
		);

	let capacityUsed = 0;
	if (activeBookings.length > 0) {
		const bookingIds = activeBookings.map((b) => b.id);
		const clientRows = await db
			.select({ bookingId: bookingClients.bookingId })
			.from(bookingClients)
			.where(inArray(bookingClients.bookingId, bookingIds));
		capacityUsed = clientRows.length;
	}

	const maxCapacity = MAX_CAPACITY[serviceType] ?? 999;

	return apiResponse({
		available: capacityUsed < maxCapacity,
		capacity_used: capacityUsed,
		max_capacity: maxCapacity
	});
};
