import { fail, redirect } from '@sveltejs/kit';
import { createBooking } from '$lib/features/bookings/queries';
import { listServices } from '$lib/features/services/queries';
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
	return { services, instructors, clients, defaultDate };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		const instructorId = form.get('instructorId')?.toString() || undefined;
		const date = form.get('date')?.toString() ?? '';
		const time = form.get('time')?.toString() || undefined;
		const isFlexible = form.get('isFlexible') === 'on';
		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes = form.get('notes')?.toString().trim() || undefined;

		if (!serviceId || !date) {
			return fail(400, { error: 'Service and date are required' });
		}

		const clientIds = form.getAll('clientId').map(String);
		const amounts = form.getAll('amountDue').map(String);

		if (clientIds.length === 0) {
			return fail(400, { error: 'At least one client is required' });
		}

		const clients = clientIds.map((clientId, i) => ({
			clientId,
			amountDue: amounts[i] ?? '0'
		}));

		const booking = await createBooking({
			serviceId,
			instructorId,
			date,
			time,
			isFlexible,
			spotNotes,
			notes,
			clients
		});

		redirect(302, `/bookings/${booking.id}`);
	}
};
