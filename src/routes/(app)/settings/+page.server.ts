import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { user: locals.user! };
};

export const actions: Actions = {
	updateName: async ({ request, locals }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { nameError: 'Name is required' });

		try {
			await auth.api.updateUser({
				headers: request.headers,
				body: { name }
			});
			return { nameSuccess: true };
		} catch {
			return fail(500, { nameError: 'Failed to update name' });
		}
	},

	changePassword: async ({ request }) => {
		const form = await request.formData();
		const currentPassword = form.get('currentPassword')?.toString() ?? '';
		const newPassword = form.get('newPassword')?.toString() ?? '';
		const confirmPassword = form.get('confirmPassword')?.toString() ?? '';

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { passwordError: 'All fields are required' });
		}
		if (newPassword.length < 8) {
			return fail(400, { passwordError: 'New password must be at least 8 characters' });
		}
		if (newPassword !== confirmPassword) {
			return fail(400, { passwordError: 'Passwords do not match' });
		}

		try {
			await auth.api.changePassword({
				headers: request.headers,
				body: { currentPassword, newPassword, revokeOtherSessions: false }
			});
			return { passwordSuccess: true };
		} catch {
			return fail(400, { passwordError: 'Current password is incorrect' });
		}
	},

	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/auth/login');
	}
};
