import { fail } from '@sveltejs/kit';
import { createBooking, countEnrolledClientsForService } from '$lib/features/bookings/queries';
import { createSession } from '$lib/features/sessions/queries';
import { listServices, getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import { listUnitTypesByService, getAvailableUnits } from '$lib/features/accommodation/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [services, instructors, clients] = await Promise.all([
		listServices(),
		listInstructors(),
		listClients()
	]);
	const defaultDate = url.searchParams.get('date') ?? '';
	const defaultTime = url.searchParams.get('time') ?? '';

	// Pre-load unit types for any accommodation services
	const accommodationServices = services.filter((s) => s.hasInventoryUnits);
	const unitTypesByService: Record<string, Awaited<ReturnType<typeof listUnitTypesByService>>> = {};
	await Promise.all(
		accommodationServices.map(async (s) => {
			unitTypesByService[s.id] = await listUnitTypesByService(s.id);
		})
	);

	return { services, instructors, clients, defaultDate, defaultTime, unitTypesByService };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		if (!serviceId) return fail(400, { error: 'Service is required' });

		const service = await getService(serviceId);
		if (!service) return fail(400, { error: 'Service not found' });

		// ── Accommodation ─────────────────────────────────────────────────────
		if (service.hasInventoryUnits) {
			const unitTypeId = form.get('accommodationUnitTypeId')?.toString() ?? '';
			const checkIn = form.get('date')?.toString() ?? '';
			const checkOut = form.get('dateEnd')?.toString() ?? '';
			const guestsCount = parseInt(form.get('guestsCount')?.toString() ?? '1');

			if (!unitTypeId) return fail(400, { error: 'Select a unit type' });
			if (!checkIn || !checkOut || checkIn >= checkOut)
				return fail(400, { error: 'Valid check-in and check-out dates required' });

			const available = await getAvailableUnits(unitTypeId, checkIn, checkOut);
			if (available.length === 0)
				return fail(400, { error: 'No units available for those dates' });

			const unit = available[0];
			const clientIds = form.getAll('clientId').map(String).filter(Boolean);
			const amounts = form.getAll('amountDue').map(String);
			if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

			const booking = await createBooking({
				serviceId,
				accommodationUnitId: unit.id,
				guestsCount,
				date: checkIn,
				dateEnd: checkOut,
				isFlexible: false,
				status: 'confirmed',
				clients: clientIds.map((clientId, i) => ({ clientId, amountDue: amounts[i] ?? '0' }))
			});
			return { bookingId: booking.id, message: `Booked — ${unit.name}` };
		}

		// ── All non-accommodation services (lessons, camps, products, rentals) ──
		const instructorId = form.get('instructorId')?.toString() || undefined;
		// Camps pre-fill dates from the service; other services use form inputs
		const date = form.get('date')?.toString() ?? service.startDate ?? '';
		const dateEnd = form.get('dateEnd')?.toString() || service.endDate || undefined;
		const time = form.get('time')?.toString() || undefined;
		const isFlexible = form.get('isFlexible') === 'on';
		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes = form.get('notes')?.toString().trim() || undefined;

		if (!date) return fail(400, { error: 'Date is required' });

		const clientIds = form.getAll('clientId').map(String);
		const amounts = form.getAll('amountDue').map(String);
		if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

		// Capacity check for roster services (group lessons, camps)
		if (service.hasRoster && service.maxCapacity) {
			const enrolled = await countEnrolledClientsForService(serviceId);
			const available = service.maxCapacity - enrolled;
			if (clientIds.length > available)
				return fail(400, { error: `Only ${available} slot${available !== 1 ? 's' : ''} remaining` });
		}

		const bookingClients = clientIds.map((clientId, i) => ({ clientId, amountDue: amounts[i] ?? '0' }));
		const status = isFlexible ? 'pending' : 'confirmed';

		// For hasSessions services: read sessionsIncluded, ignore multi-day form fields
		if (service.hasSessions) {
			const sessionsIncludedRaw = form.get('sessionsIncluded')?.toString();
			const sessionsIncluded = sessionsIncludedRaw ? Math.max(1, parseInt(sessionsIncludedRaw)) : 1;

			const booking = await createBooking({
				serviceId, date, isFlexible, status, spotNotes, notes,
				sessionsIncluded,
				clients: bookingClients
				// NO instructorId for session-based services — instructor is set per-session
			});

			// Create sessions: first session gets the entered time (if not flexible), rest are unscheduled
			await Promise.all(
				Array.from({ length: sessionsIncluded }, (_, i) =>
					createSession({
						bookingId: booking.id,
						date,
						time: i === 0 && !isFlexible ? time : undefined,
						sortOrder: i
					})
				)
			);

			const scheduled = !isFlexible && time ? 1 : 0;
			const remaining = sessionsIncluded - scheduled;
			const msg = scheduled > 0
				? remaining > 0
					? `Booking created — 1 session at ${time!.slice(0,5)}, ${remaining} to schedule`
					: `Booking created — session at ${time!.slice(0,5)}`
				: `Booking created — ${sessionsIncluded} session${sessionsIncluded > 1 ? 's' : ''} to schedule`;
			return { bookingId: booking.id, message: msg };
		}

		// Non-sessions services: support multi-day booking creation (separate contracts)
		const extraDates = form.getAll('extraDate').map(String).filter(Boolean);
		const extraTimes = form.getAll('extraTime').map(String);
		const allDays = [
			{ date, time },
			...extraDates.map((d, i) => ({ date: d, time: extraTimes[i] || undefined }))
		];

		if (allDays.length === 1) {
			const booking = await createBooking({
				serviceId, instructorId, date, dateEnd, time, isFlexible, status, spotNotes, notes,
				clients: bookingClients
			});
			return { bookingId: booking.id, message: 'Booking created' };
		} else {
			await Promise.all(
				allDays.map(({ date: d, time: t }) =>
					createBooking({ serviceId, instructorId, date: d, time: t || undefined, isFlexible, status, spotNotes, notes, clients: bookingClients })
				)
			);
			return { multiDay: true, date, message: `${allDays.length} bookings created` };
		}
	}
};
