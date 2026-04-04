import { error, fail, redirect } from '@sveltejs/kit';
import { getEvent, updateEvent, deleteEvent } from '$lib/features/events/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const event = await getEvent(params.id);
	if (!event) error(404, 'Event not found');
	return { event };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim() ?? '';
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate = form.get('endDate')?.toString() ?? '';
		if (!title || !startDate || !endDate) return fail(400, { error: 'Required fields missing' });
		await updateEvent(params.id, {
			title,
			startDate,
			endDate,
			description: form.get('description')?.toString().trim() || undefined,
			price: form.get('price')?.toString() || undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		return { error: null };
	},
	delete: async ({ params }) => {
		await deleteEvent(params.id);
		redirect(302, '/events');
	}
};
