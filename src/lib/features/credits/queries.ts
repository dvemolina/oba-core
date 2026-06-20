import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, bookingClients, services } from '$lib/server/db/schema';
import type { CreditsModuleConfig } from '$lib/features/services/modules';

export interface CreditSource {
	bookingId: string;
	serviceName: string;
	creditsIncluded: number;
	quantity: number;
	totalCredits: number;
	creditsUsed: number;
	creditsRemaining: number;
	validTo: string | null;
	expired: boolean;
	creditType?: string;
}

export async function getAvailableCreditsForClient(
	clientId: string,
	targetServiceId: string,
	referenceDate: string
): Promise<CreditSource[]> {
	const clientBookings = await db
		.select({
			bookingId: bookingClients.bookingId,
			serviceId: bookings.serviceId,
			serviceName: services.name,
			serviceModules: services.modules,
			bookingQuantity: bookings.quantity,
			bookingCreatedAt: bookings.createdAt
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.innerJoin(services, eq(bookings.serviceId, services.id))
		.where(and(
			eq(bookingClients.clientId, clientId),
			ne(bookingClients.status, 'cancelled')
		));

	// Don't allow using credits from the same booking being paid for
	const sources: CreditSource[] = [];

	for (const row of clientBookings) {
		if (row.bookingId === targetServiceId) continue;
		const modules = row.serviceModules as Record<string, unknown> | null;
		const config = modules?.credits as CreditsModuleConfig | undefined;
		if (!config) continue;

		// Compatibility check (empty array means all services are compatible)
		if (
			config.compatibleServiceIds.length > 0 &&
			!config.compatibleServiceIds.includes(targetServiceId)
		) continue;

		// Expiry check
		const ref = new Date(referenceDate + 'T00:00:00');
		let expired = false;
		let validTo: string | null = null;

		if (config.validityMode === 'range') {
			if (config.validFrom && ref < new Date(config.validFrom + 'T00:00:00')) {
				expired = true;
			}
			if (config.validTo) {
				validTo = config.validTo;
				if (ref > new Date(config.validTo + 'T23:59:59')) expired = true;
			}
		} else if (config.validityMode === 'days' && config.validityDays) {
			const expiry = new Date(row.bookingCreatedAt);
			expiry.setDate(expiry.getDate() + config.validityDays);
			validTo = expiry.toISOString().slice(0, 10);
			if (ref > expiry) expired = true;
		}

		// Credits already consumed from this source booking
		const [usedRow] = await db
			.select({ total: sql<string>`COALESCE(SUM(${bookingClients.creditCount}), 0)` })
			.from(bookingClients)
			.where(eq(bookingClients.creditSourceId, row.bookingId));

		const quantity = row.bookingQuantity ?? 1;
		const totalCredits = config.creditsIncluded * quantity;
		const creditsUsed = parseInt(usedRow?.total ?? '0');
		const creditsRemaining = Math.max(0, totalCredits - creditsUsed);

		sources.push({
			bookingId: row.bookingId,
			serviceName: row.serviceName ?? 'Servicio',
			creditsIncluded: config.creditsIncluded,
			quantity,
			totalCredits,
			creditsUsed,
			creditsRemaining,
			validTo,
			expired,
			creditType: config.creditType
		});
	}

	return sources;
}

export async function getCreditsUsedFromBooking(sourceBookingId: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<string>`COALESCE(SUM(${bookingClients.creditCount}), 0)` })
		.from(bookingClients)
		.where(eq(bookingClients.creditSourceId, sourceBookingId));
	return parseInt(row?.total ?? '0');
}
