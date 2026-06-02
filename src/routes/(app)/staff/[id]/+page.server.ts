import { error, fail } from '@sveltejs/kit';
import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner');

	const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
	if (!member) error(404, 'Staff member not found');

	const [linkedProfile] = await db
		.select()
		.from(instructors)
		.where(eq(instructors.userId, params.id));

	const unlinkedProfiles = await db
		.select()
		.from(instructors)
		.where(isNull(instructors.userId))
		.orderBy(instructors.name);

	return { member, linkedProfile: linkedProfile ?? null, unlinkedProfiles };
};

export const actions: Actions = {
	updateRole: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const role = form.get('role')?.toString() ?? '';
		if (!['admin', 'owner', 'manager', 'instructor'].includes(role))
			return fail(400, { error: 'Invalid role' });
		await db.update(userTable).set({ role }).where(eq(userTable.id, params.id));
		return { success: true };
	},

	linkProfile: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const instructorProfileId = form.get('instructorProfileId')?.toString() ?? '';

		await db.update(instructors).set({ userId: null }).where(eq(instructors.userId, params.id));

		if (instructorProfileId) {
			await db
				.update(instructors)
				.set({ userId: params.id })
				.where(eq(instructors.id, instructorProfileId));
		}
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
