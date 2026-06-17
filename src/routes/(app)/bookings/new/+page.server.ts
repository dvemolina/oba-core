import { fail } from '@sveltejs/kit';
import { createBooking, countEnrolledClientsForService } from '$lib/features/bookings/queries';
import { createSession } from '$lib/features/sessions/queries';
import { calculateAmount } from '$lib/utils/pricing';
import { listServices, getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import { listEditionsForService, countEnrolledClientsForEdition, getServiceEdition } from '$lib/features/services/editions.queries';
import type { ServiceEdition } from '$lib/features/services/editions.types';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const [services, instructors, clients] = await Promise.all([
		listServices(),
		listInstructors(),
		listClients()
	]);
	const defaultDate = url.searchParams.get('date') ?? '';
	const defaultTime = url.searchParams.get('time') ?? '';

	const editionsByService: Record<string, ServiceEdition[]> = {};
	await Promise.all(
		services
			.filter(s => 'editions' in (s.modules ?? {}))
			.map(async s => { editionsByService[s.id] = await listEditionsForService(s.id); })
	);

	return { services, instructors, clients, defaultDate, defaultTime, editionsByService };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		if (!serviceId) return fail(400, { error: 'Service is required' });

		const service = await getService(serviceId);
		if (!service) return fail(400, { error: 'Service not found' });

		const clientIds = form.getAll('clientId').map(String).filter(Boolean);
		if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

		const participantCounts = form.getAll('participantCount').map((v) => parseInt(v as string) || 1);

		// Calculate initial amountDue from pricingMode.
		// 1 participant assumed at creation — recalculated when participants are set from detail page.
		const _svc = service!;
		function initialAmountDue(days = 1): string {
			const base = parseFloat(_svc.basePrice);
			const sessions = _svc.defaultSessionsIncluded ?? 1;
			return calculateAmount(base, _svc.pricingMode, { participants: 1, sessions, days }).toFixed(2);
		}

		const bookingClients = clientIds.map((clientId, i) => ({
			clientId,
			amountDue: initialAmountDue(),
			participantCount: participantCounts[i] ?? 1
		}));

		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes     = form.get('notes')?.toString().trim() || undefined;

		// ── Accommodation ──────────────────────────────────────────────────────
		if ('inventory' in (service.modules ?? {})) {
			const checkIn  = form.get('date')?.toString() ?? '';
			const checkOut = form.get('dateEnd')?.toString() || null;
			if (!checkIn) return fail(400, { error: 'Start date is required' });

			let days = 1;
			if (checkOut) {
				const d = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
				days = Math.max(1, d);
			}
			const invClients = clientIds.map((clientId, i) => ({
				clientId,
				amountDue: initialAmountDue(days),
				participantCount: participantCounts[i] ?? 1
			}));

			const booking = await createBooking({
				serviceId,
				date: checkIn,
				dateEnd: checkOut ?? undefined,
				isFlexible: false,
				status: 'confirmed',
				clients: invClients
			});
			return { bookingId: booking.id, message: 'Booking created — assign inventory from the booking detail' };
		}

		// ── Shared date resolution ─────────────────────────────────────────────
		const serviceEditionId = form.get('serviceEditionId')?.toString() || undefined;
		let date    = form.get('date')?.toString() ?? '';
		let dateEnd = form.get('dateEnd')?.toString() || undefined;
		if ('editions' in (service.modules ?? {}) && serviceEditionId) {
			const edition = await getServiceEdition(serviceEditionId);
			if (edition) { date = edition.startDate; dateEnd = edition.endDate; }
		}
		if (!date) return fail(400, { error: 'Date is required' });

		// ── Capacity check ─────────────────────────────────────────────────────
		const totalParticipantsRequested = participantCounts.reduce((s, n) => s + n, 0);

		if ('roster' in (service.modules ?? {}) && serviceEditionId) {
			const edition = await getServiceEdition(serviceEditionId);
			if (edition?.maxCapacity) {
				const enrolled  = await countEnrolledClientsForEdition(serviceEditionId);
				const available = edition.maxCapacity - enrolled;
				if (totalParticipantsRequested > available)
					return fail(400, { error: `Solo quedan ${available} plaza${available !== 1 ? 's' : ''} en esta edición` });
			}
		} else if ('roster' in (service.modules ?? {}) && service.maxCapacity) {
			const enrolled  = await countEnrolledClientsForService(serviceId);
			const available = service.maxCapacity - enrolled;
			if (totalParticipantsRequested > available)
				return fail(400, { error: `Solo quedan ${available} plaza${available !== 1 ? 's' : ''} disponibles` });
		}

		// Require edition when service uses editions module and editions exist
		if ('editions' in (service.modules ?? {}) && !serviceEditionId)
			return fail(400, { error: 'Selecciona una edición para continuar' });

		// ── Lessons (sessions module) ──────────────────────────────────────────
		// Auto-create N unscheduled sessions from service default.
		// Sessions are scheduled from the booking detail page.
		if ('sessions' in (service.modules ?? {})) {
			const sessionsIncluded = service.defaultSessionsIncluded ?? 1;

			const booking = await createBooking({
				serviceId, serviceEditionId, date,
				isFlexible: true,
				status: 'confirmed',
				sessionsIncluded,
				spotNotes, notes,
				clients: bookingClients
			});

			await Promise.all(
				Array.from({ length: sessionsIncluded }, (_, i) =>
					createSession({ bookingId: booking.id, date, sortOrder: i })
				)
			);

			const n = sessionsIncluded;
			return {
				bookingId: booking.id,
				message: `Booking created — ${n} session${n !== 1 ? 's' : ''} to schedule`
			};
		}

		// ── Regular / camp ─────────────────────────────────────────────────────
		const instructorId = form.get('instructorId')?.toString() || undefined;
		const time         = form.get('time')?.toString() || undefined;
		const isFlexible   = form.get('isFlexible') === 'on';
		const status       = isFlexible ? 'pending' : 'confirmed';

		const booking = await createBooking({
			serviceId, instructorId, serviceEditionId, date, dateEnd, time,
			isFlexible, status, spotNotes, notes,
			clients: bookingClients
		});
		return { bookingId: booking.id, message: 'Booking created' };
	}
};
