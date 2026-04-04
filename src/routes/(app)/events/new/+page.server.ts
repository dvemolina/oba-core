import { fail, redirect } from '@sveltejs/kit';
import { createEvent } from '$lib/features/events/queries';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim() ?? '';
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate = form.get('endDate')?.toString() ?? '';

		if (!title || !startDate || !endDate) {
			return fail(400, { error: 'Title, start date, and end date are required' });
		}
		if (endDate < startDate) {
			return fail(400, { error: 'End date must be after start date' });
		}

		await createEvent({
			title,
			startDate,
			endDate,
			description: form.get('description')?.toString().trim() || undefined,
			price: form.get('price')?.toString() || undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		redirect(302, '/events');
	}
};
