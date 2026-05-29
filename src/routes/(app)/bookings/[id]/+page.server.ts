import { error, fail } from '@sveltejs/kit';
import {
	cancelBooking,
	getBooking,
	updateBooking,
	updateBookingClientPayment,
	updateBookingClientAmountDue,
	cancelBookingClient,
	reenrollBookingClient,
	addClientToBooking,
	removeClientFromBooking
} from '$lib/features/bookings/queries';
import { getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import type { BookingStatus } from '$lib/features/bookings/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [booking, instructors] = await Promise.all([getBooking(params.id), listInstructors()]);
	if (!booking) error(404, 'Booking not found');

	const isCamp = booking.serviceType === 'camp';
	const [service, clients] = await Promise.all([
		booking.serviceId ? getService(booking.serviceId) : Promise.resolve(undefined),
		isCamp ? listClients() : Promise.resolve([])
	]);

	return { booking, instructors, service: service ?? null, clients, isCamp };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const newStatus = form.get('status')?.toString() as BookingStatus;
		await updateBooking(params.id, {
			instructorId: form.get('instructorId')?.toString() || null,
			date: form.get('date')?.toString(),
			time: form.get('time')?.toString() || null,
			isFlexible: form.get('isFlexible') === 'true',
			status: newStatus,
			spotNotes: form.get('spotNotes')?.toString() || null,
			notes: form.get('notes')?.toString() || null
		});
		const message = newStatus === 'confirmed' ? 'Booking confirmed' : 'Booking updated';
		return { error: null, message };
	},

	updatePayment: async ({ request }) => {
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		const amountPaid = form.get('amountPaid')?.toString() ?? '0';
		const amountDue = parseFloat(form.get('amountDue')?.toString() ?? '0');
		const paid = parseFloat(amountPaid);
		const status = paid >= amountDue ? 'paid' : paid > 0 ? 'partial' : 'pending';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await updateBookingClientPayment(bookingClientId, amountPaid, status);
		return { error: null, message: 'Payment updated' };
	},

	enroll: async ({ request, params }) => {
		const form = await request.formData();
		const clientId = form.get('clientId')?.toString() ?? '';
		const amountDue = form.get('amountDue')?.toString() ?? '0';
		if (!clientId) return fail(400, { error: 'Client is required' });

		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Booking not found' });

		const max = booking.serviceMaxStudents ?? Infinity;
		if (booking.clients.length >= max) return fail(400, { error: 'Camp is full' });

		const alreadyEnrolled = booking.clients.some((c) => c.clientId === clientId);
		if (alreadyEnrolled) return fail(400, { error: 'Client already enrolled' });

		await addClientToBooking(params.id, clientId, amountDue);
		return { error: null, message: 'Student enrolled' };
	},

	unenroll: async ({ request, params }) => {
		const form = await request.formData();
		const clientId = form.get('clientId')?.toString() ?? '';
		if (!clientId) return fail(400, { error: 'Client is required' });
		await removeClientFromBooking(params.id, clientId);
		return { error: null, message: 'Student removed' };
	},

	cancel: async ({ params }) => {
		await cancelBooking(params.id);
		return { cancelled: true, message: 'Booking cancelled' };
	},

	updateAmountDue: async ({ request }) => {
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		const amountDue = form.get('amountDue')?.toString() ?? '0';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await updateBookingClientAmountDue(bookingClientId, amountDue);
		return { error: null, message: 'Amount updated' };
	},

	cancelClient: async ({ request }) => {
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await cancelBookingClient(bookingClientId);
		return { error: null, message: 'Client enrollment cancelled' };
	},

	reenrollClient: async ({ request }) => {
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await reenrollBookingClient(bookingClientId);
		return { error: null, message: 'Client re-enrolled' };
	}
};
