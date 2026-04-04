import { fail, redirect } from '@sveltejs/kit';
import { createClient } from '$lib/features/clients/queries';
import type { SkillLevel } from '$lib/features/clients/types';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const firstName = form.get('firstName')?.toString().trim() ?? '';
		const lastName = form.get('lastName')?.toString().trim() ?? '';

		if (!firstName || !lastName) {
			return fail(400, { error: 'First and last name are required' });
		}

		await createClient({
			firstName,
			lastName,
			phone: form.get('phone')?.toString().trim() || undefined,
			email: form.get('email')?.toString().trim() || undefined,
			nationality: form.get('nationality')?.toString().trim() || undefined,
			skillLevel: (form.get('skillLevel')?.toString() || undefined) as SkillLevel | undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		redirect(302, '/clients');
	}
};
