import { error, fail, redirect } from '@sveltejs/kit';
import { getInstructor, updateInstructor } from '$lib/features/instructors/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const instructor = await getInstructor(params.id);
	if (!instructor) error(404, 'Instructor not found');
	return { instructor };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { error: 'Name is required' });

		await updateInstructor(params.id, {
			name,
			phone: form.get('phone')?.toString().trim() || undefined,
			email: form.get('email')?.toString().trim() || undefined,
			bio: form.get('bio')?.toString().trim() || undefined
		});
		redirect(302, '/instructors');
	},

	toggle: async ({ params }) => {
		const instructor = await getInstructor(params.id);
		if (!instructor) error(404);
		await updateInstructor(params.id, { active: !instructor.active });
		return {};
	}
};
