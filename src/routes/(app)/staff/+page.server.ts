import { requireRole, hasRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { ne } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	const isAdmin = hasRole(locals, 'admin');
	// Admins see everyone (including other admins); owners see non-admins only
	const staff = isAdmin
		? await db.select().from(userTable).orderBy(userTable.name)
		: await db.select().from(userTable).where(ne(userTable.role, 'admin')).orderBy(userTable.name);
	return { staff, isAdmin };
};
