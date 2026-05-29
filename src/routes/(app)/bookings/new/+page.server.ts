import { fail } from '@sveltejs/kit';
import { createBooking, getOrCreateCampBooking, addClientToBooking } from '$lib/features/bookings/queries';
import { listServices, getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [services, instructors, clients] = await Promise.all([
		listServices(),
		listInstructors(),
		listClients()
	]);
	const defaultDate = url.searchParams.get('date') ?? '';
	const defaultTime = url.searchParams.get('time') ?? '';
	return { services, instructors, clients, defaultDate, defaultTime };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		if (!serviceId) return fail(400, { error: 'Service is required' });

		const service = await getService(serviceId);
		if (!service) return fail(400, { error: 'Service not found' });

		// ── Camp: enroll into single camp booking ────────────────────────────
		if (service.type === 'camp') {
			const clientIds = form.getAll('clientId').map(String).filter(Boolean);
			if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

			const campBooking = await getOrCreateCampBooking(service);
			const enrolled = campBooking.clients.length;
			const max = service.maxStudents ?? Infinity;
			const available = max - enrolled;

			if (clientIds.length > available)
				return fail(400, { error: `Only ${available} slot${available !== 1 ? 's' : ''} remaining in this camp` });

			const existingIds = new Set(campBooking.clients.map((c) => c.clientId));
			const duplicates = clientIds.filter((id) => existingIds.has(id));
			if (duplicates.length > 0)
				return fail(400, { error: 'One or more clients are already enrolled in this camp' });

			const amounts = form.getAll('amountDue').map(String);
			for (let i = 0; i < clientIds.length; i++) {
				await addClientToBooking(campBooking.id, clientIds[i], amounts[i] ?? service.basePrice);
			}
			return { bookingId: campBooking.id, message: `${clientIds.length > 1 ? `${clientIds.length} clients` : 'Client'} enrolled in camp` };
		}

		// ── Lesson / Product / Rental / Accommodation ─────────────────────────
		const instructorId = form.get('instructorId')?.toString() || undefined;
		const date = form.get('date')?.toString() ?? '';
		const dateEnd = form.get('dateEnd')?.toString() || undefined;
		const time = form.get('time')?.toString() || undefined;
		const isFlexible = form.get('isFlexible') === 'on';
		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes = form.get('notes')?.toString().trim() || undefined;

		if (!date) return fail(400, { error: 'Date is required' });

		const clientIds = form.getAll('clientId').map(String);
		const amounts = form.getAll('amountDue').map(String);
		if (clientIds.length === 0) return fail(400, { error: 'At least one client is required' });

		const bookingClients = clientIds.map((clientId, i) => ({ clientId, amountDue: amounts[i] ?? '0' }));
		const extraDates = form.getAll('extraDate').map(String).filter(Boolean);
		const extraTimes = form.getAll('extraTime').map(String);
		const allDays = [
			{ date, time },
			...extraDates.map((d, i) => ({ date: d, time: extraTimes[i] || undefined }))
		];
		const status = isFlexible ? 'pending' : 'confirmed';

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
