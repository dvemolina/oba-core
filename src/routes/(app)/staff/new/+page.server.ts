import { fail, redirect } from '@sveltejs/kit';
import { requireRole, primaryRole } from '$lib/server/permissions';
import type { Role } from '$lib/server/permissions';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq, isNull } from 'drizzle-orm';
import { sendStaffInvite, generateTempPassword } from '$lib/server/email/sender';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	const unlinkedProfiles = await db
		.select()
		.from(instructors)
		.where(isNull(instructors.userId))
		.orderBy(instructors.name);
	return { unlinkedProfiles };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim() ?? '';
		const selectedRoles = form.getAll('roles')
			.map(r => r.toString())
			.filter(r => ['admin', 'owner', 'manager', 'instructor'].includes(r)) as Role[];
		const instructorProfileId = form.get('instructorProfileId')?.toString() || null;

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
			.set({ roles: selectedRoles, role: primary })
			.where(eq(userTable.id, newUserId));

		if (instructorProfileId) {
			await db
				.update(instructors)
				.set({ userId: newUserId })
				.where(eq(instructors.id, instructorProfileId));
		}

		await sendStaffInvite({ to: email, name, role: primary ?? selectedRoles[0], tempPassword });

		redirect(302, '/staff');
	}
};
