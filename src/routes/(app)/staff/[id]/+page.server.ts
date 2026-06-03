import { error, fail } from '@sveltejs/kit';
import { requireRole, hasRole, primaryRole } from '$lib/server/permissions';
import type { Role } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner');
	const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
	if (!member) error(404, 'Staff member not found');
	return { member, isAdmin: hasRole(locals, 'admin') };
};

export const actions: Actions = {
	updateRole: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const isAdmin = hasRole(locals, 'admin');
		const form = await request.formData();
		const allowedRoles = isAdmin
			? ['admin', 'owner', 'manager', 'instructor']
			: ['owner', 'manager', 'instructor'];
		const selectedRoles = form.getAll('roles')
			.map(r => r.toString())
			.filter(r => allowedRoles.includes(r)) as Role[];
		if (selectedRoles.length === 0) return fail(400, { error: 'At least one role is required' });
		const primary = primaryRole(selectedRoles);
		await db.update(userTable)
			.set({ roles: selectedRoles, role: primary })
			.where(eq(userTable.id, params.id));
		return { success: true };
	},

	updateProfile: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const phone = form.get('phone')?.toString().trim() || null;
		const bio = form.get('bio')?.toString().trim() || null;
		const active = form.get('active') === 'true';
		await db.update(userTable)
			.set({ phone, bio, active, updatedAt: new Date() })
			.where(eq(userTable.id, params.id));
		return { success: true };
	},

	toggleBan: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		if (params.id === locals.user?.id) return fail(400, { error: "Can't ban yourself" });
		const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
		if (!member) error(404);
		await db.update(userTable).set({ banned: !member.banned }).where(eq(userTable.id, params.id));
		return {};
	}
};
