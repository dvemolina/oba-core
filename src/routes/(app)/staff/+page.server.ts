import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { isNotNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');

	const [users, linkedProfiles] = await Promise.all([
		db.select().from(userTable).orderBy(userTable.name),
		db.select().from(instructors).where(isNotNull(instructors.userId))
	]);

	const profileByUserId = new Map(linkedProfiles.map(p => [p.userId, p]));

	const staff = users.map(u => ({
		...u,
		instructorProfile: profileByUserId.get(u.id) ?? null
	}));

	return { staff };
};
