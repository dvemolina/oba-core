import { fail } from '@sveltejs/kit';
import { requireRole, primaryRole } from '$lib/server/permissions';
import type { Role } from '$lib/server/permissions';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { sendStaffInvite, generateTempPassword } from '$lib/server/email/sender';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim() ?? '';
		const phone = form.get('phone')?.toString().trim() || null;
		const selectedRoles = form.getAll('roles')
			.map(r => r.toString())
			.filter(r => ['admin', 'owner', 'manager', 'instructor'].includes(r)) as Role[];

		if (!name) return fail(400, { error: 'Name is required' });
		if (!email) return fail(400, { error: 'Email is required' });
		if (selectedRoles.length === 0) return fail(400, { error: 'At least one role is required' });

		const tempPassword = generateTempPassword();

		let newUserId: string;
		try {
			const result = await auth.api.signUpEmail({
				body: { name, email, password: tempPassword }
			});
			if (!result?.user) return fail(400, { error: 'Failed to create account (email may already exist)' });
			newUserId = result.user.id;
		} catch {
			return fail(400, { error: 'Failed to create account (email may already exist)' });
		}

		const primary = primaryRole(selectedRoles);
		await db.update(userTable)
			.set({ roles: selectedRoles, role: primary, phone })
			.where(eq(userTable.id, newUserId));

		// Send invite email (non-blocking — if it fails user is still created and password shown on screen)
		try {
			await sendStaffInvite({ to: email, name, role: primary ?? selectedRoles[0], tempPassword });
		} catch {
			// Email failure is non-fatal — admin can share the password shown on screen
		}

		// Return temp password so admin can share it if email delivery fails
		return { created: true, name, email, tempPassword, userId: newUserId };
	}
};
