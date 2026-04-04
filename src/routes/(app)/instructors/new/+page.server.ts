import { fail, redirect } from '@sveltejs/kit';
import { createInstructor } from '$lib/features/instructors/queries';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const phone = form.get('phone')?.toString().trim() || undefined;
		const email = form.get('email')?.toString().trim() || undefined;
		const bio = form.get('bio')?.toString().trim() || undefined;

		if (!name) return fail(400, { error: 'Name is required' });

		await createInstructor({ name, phone, email, bio });
		redirect(302, '/instructors');
	}
};
