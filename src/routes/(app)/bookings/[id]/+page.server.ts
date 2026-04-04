import { error, fail, redirect } from '@sveltejs/kit';
import {
	cancelBooking,
	getBooking,
	updateBooking,
	updateBookingClientPayment
} from '$lib/features/bookings/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { BookingStatus } from '$lib/features/bookings/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [booking, instructors] = await Promise.all([getBooking(params.id), listInstructors()]);
	if (!booking) error(404, 'Booking not found');
	return { booking, instructors };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		await updateBooking(params.id, {
			instructorId: form.get('instructorId')?.toString() || null,
			date: form.get('date')?.toString(),
			time: form.get('time')?.toString() || null,
			isFlexible: form.get('isFlexible') === 'true',
			status: form.get('status')?.toString() as BookingStatus,
			spotNotes: form.get('spotNotes')?.toString() || null,
			notes: form.get('notes')?.toString() || null
		});
		return { error: null };
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
		return { error: null };
	},

	cancel: async ({ params }) => {
		await cancelBooking(params.id);
		redirect(302, '/calendar');
	}
};
