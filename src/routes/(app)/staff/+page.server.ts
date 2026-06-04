import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { ne } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	const staff = await db.select().from(userTable).where(ne(userTable.role, 'admin')).orderBy(userTable.name);
	return { staff };
};
