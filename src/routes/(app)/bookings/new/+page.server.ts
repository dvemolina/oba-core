import { fail } from '@sveltejs/kit';
import { createBooking, countEnrolledClientsForService } from '$lib/features/bookings/queries';
import { createSession, addParticipant } from '$lib/features/sessions/queries';
import { bulkAddBookingParticipants } from '$lib/features/bookings/participants.queries';
import { listServices, getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import { listRunsForService, countEnrolledClientsForRun, getServiceRun } from '$lib/features/services/runs.queries';
import type { ServiceRun } from '$lib/features/services/runs.types';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';
import { listLinksForService } from '$lib/features/inventory/serviceLinks.queries';
import { checkAvailability, listItemsByType } from '$lib/features/inventory/queries';
import type { CreateAllocationInput } from '$lib/features/inventory/types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const [services, instructors, clients] = await Promise.all([
		listServices(),
		listInstructors(),
		listClients()
	]);
	const defaultDate = url.searchParams.get('date') ?? '';
	const defaultTime = url.searchParams.get('time') ?? '';

	const inventoryServices = services.filter((s) => s.hasInventoryUnits);
	type LinkWithItems = Awaited<ReturnType<typeof listLinksForService>>[0] & { items: Awaited<ReturnType<typeof listItemsByType>> };
	const inventoryLinksByService: Record<string, LinkWithItems[]> = {};
	await Promise.all(
		inventoryServices.map(async (s) => {
			const links = await listLinksForService(s.id);
			inventoryLinksByService[s.id] = await Promise.all(
				links.map(async (link) => ({
					...link,
					items: link.itemType.trackingMode === 'specific' ? await listItemsByType(link.itemTypeId) : []
				}))
			);
		})
	);

	const runsByService: Record<string, ServiceRun[]> = {};
	await Promise.all(
		services
			.filter(s => s.hasDateRange)
			.map(async s => { runsByService[s.id] = await listRunsForService(s.id); })
	);

	return { services, instructors, clients, defaultDate, defaultTime, inventoryLinksByService, runsByService };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		if (!serviceId) return fail(400, { error: 'Service is required' });

		const service = await getService(serviceId);
		if (!service) return fail(400, { error: 'Service not found' });

		if (service.hasInventoryUnits) {
			const checkIn = form.get('date')?.toString() ?? '';
			const checkOut = form.get('dateEnd')?.toString() || null;
			const clientIds = form.getAll('clientId').map(String).filter(Boolean);
			const amounts = form.getAll('amountDue').map(String);

			if (!checkIn) return fail(400, { error: 'Start date is required' });
			if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

			const links = await listLinksForService(serviceId);
			const allocations: CreateAllocationInput[] = [];

			for (const link of links) {
				const qtyRaw = form.get(`qty_${link.itemTypeId}`)?.toString();
				const qty = qtyRaw ? parseInt(qtyRaw) : link.quantityPerBooking;

				// Build attribute filter from per-attribute select fields
				const attributeFilter: Record<string, string> = {};
				for (const key of Object.keys(link.itemType.attributeSchema)) {
					const val = form.get(`attr_${link.itemTypeId}_${key}`)?.toString();
					if (val) attributeFilter[key] = val;
				}
				const filter = Object.keys(attributeFilter).length > 0 ? attributeFilter : null;

				const avail = await checkAvailability(link.itemTypeId, checkIn, checkOut, qty, filter ?? undefined);
				if (avail.availableCount < qty) {
					return fail(400, { error: `Not enough "${link.itemType.name}" available for those dates` });
				}

				const requestedItemId = form.get(`specificItem_${link.itemTypeId}`)?.toString() || null;
				const itemId = (requestedItemId && avail.availableItems.some(i => i.id === requestedItemId))
					? requestedItemId
					: (avail.availableItems[0]?.id ?? null);
				allocations.push({
					bookingId: '',
					itemTypeId: link.itemTypeId,
					itemId,
					quantity: qty,
					attributeFilter: filter,
					startDate: checkIn,
					endDate: checkOut
				});
			}

			const booking = await createBooking({
				serviceId,
				date: checkIn,
				dateEnd: checkOut ?? undefined,
				isFlexible: false,
				status: 'confirmed',
				allocations,
				clients: clientIds.map((clientId, i) => ({ clientId, amountDue: amounts[i] ?? '0' }))
			});
			return { bookingId: booking.id, message: 'Booking created' };
		}

		// ── All non-accommodation services (lessons, camps, products, rentals) ──
		const instructorId = form.get('instructorId')?.toString() || undefined;
		const serviceRunId = form.get('serviceRunId')?.toString() || undefined;
		// For date-range services with a run: derive dates from the run
		let date = form.get('date')?.toString() ?? '';
		let dateEnd = form.get('dateEnd')?.toString() || undefined;
		if (service.hasDateRange && serviceRunId) {
			const run = await getServiceRun(serviceRunId);
			if (run) {
				date = run.startDate;
				dateEnd = run.endDate;
			}
		}
		const time = form.get('time')?.toString() || undefined;
		const isFlexible = form.get('isFlexible') === 'on';
		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes = form.get('notes')?.toString().trim() || undefined;

		if (!date) return fail(400, { error: 'Date is required' });

		const clientIds = form.getAll('clientId').map(String);
		const amounts = form.getAll('amountDue').map(String);
		if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

		// Capacity check: per-run for date-range services, per-service otherwise
		if (service.hasRoster && serviceRunId) {
			const run = await getServiceRun(serviceRunId);
			if (run?.maxCapacity) {
				const enrolled = await countEnrolledClientsForRun(serviceRunId);
				const available = run.maxCapacity - enrolled;
				if (clientIds.length > available)
					return fail(400, { error: `Only ${available} spot${available !== 1 ? 's' : ''} remaining in this run` });
			}
		} else if (service.hasRoster && service.maxCapacity) {
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

			// Participant count vs named participants
			const participantCountRaw = form.get('participantCount')?.toString();
			const participantCount = participantCountRaw ? parseInt(participantCountRaw) : undefined;
			const participantNames = form.getAll('participantName')
				.map(n => n.toString().trim())
				.filter(Boolean);

			const booking = await createBooking({
				serviceId, serviceRunId, date, isFlexible, status, spotNotes, notes,
				sessionsIncluded,
				participantCount,
				clients: bookingClients
			});

			// Per-session data from accordion form
			const createdSessions = await Promise.all(
				Array.from({ length: sessionsIncluded }, (_, i) => {
					const sessionDate = form.get(`sessionDate[${i}]`)?.toString() || date;
					const sessionTime = form.get(`sessionTime[${i}]`)?.toString() || undefined;
					const sessionFlexible = form.get(`sessionFlexible[${i}]`)?.toString() === 'on';
					const sessionLevel = (form.get(`sessionLevel[${i}]`)?.toString() || undefined) as
						'beginner' | 'intermediate' | 'advanced' | undefined;
					const sessionInstructorIds = form.getAll(`sessionInstructor[${i}][]`).map(String).filter(Boolean);
					return createSession({
						bookingId: booking.id,
						date: sessionDate,
						time: !sessionFlexible && sessionTime ? sessionTime : undefined,
						skillLevel: sessionLevel,
						instructorIds: sessionInstructorIds,
						sortOrder: i
					});
				})
			);

			// Named participants, or auto-generate placeholders from count
			const namesToCreate = participantNames.length > 0
				? participantNames
				: participantCount && participantCount > 0
					? Array.from({ length: participantCount }, (_, i) => `Participant ${i + 1}`)
					: [];
			if (namesToCreate.length > 0) {
				await bulkAddBookingParticipants(booking.id, namesToCreate);
				await Promise.all(
					createdSessions.flatMap(s =>
						namesToCreate.map(name => addParticipant({ sessionId: s.id, name }))
					)
				);
			}

			const scheduled = createdSessions.filter(s => s.time).length;
			const remaining = sessionsIncluded - scheduled;
			const msg = scheduled > 0
				? remaining > 0
					? `Booking created — ${scheduled} session${scheduled > 1 ? 's' : ''} scheduled, ${remaining} to schedule`
					: `Booking created — ${scheduled} session${scheduled > 1 ? 's' : ''} scheduled`
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
				serviceId, instructorId, serviceRunId, date, dateEnd, time, isFlexible, status, spotNotes, notes,
				clients: bookingClients
			});
			return { bookingId: booking.id, message: 'Booking created' };
		} else {
			await Promise.all(
				allDays.map(({ date: d, time: t }) =>
					createBooking({ serviceId, instructorId, serviceRunId, date: d, time: t || undefined, isFlexible, status, spotNotes, notes, clients: bookingClients })
				)
			);
			return { multiDay: true, date, message: `${allDays.length} bookings created` };
		}
	}
};
