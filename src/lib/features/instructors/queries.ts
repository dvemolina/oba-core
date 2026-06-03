import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import type { Instructor } from './types';

function toInstructor(u: typeof userTable.$inferSelect): Instructor {
	return {
		id: u.id,
		name: u.name,
		phone: u.phone ?? null,
		email: u.email,
		bio: u.bio ?? null,
		active: u.active ?? true,
		roles: u.roles ?? []
	};
}

export async function listInstructors(includeInactive = false): Promise<Instructor[]> {
	const rows = await db
		.select()
		.from(userTable)
		.where(
			includeInactive
				? sql`'instructor' = ANY(${userTable.roles})`
				: and(
						sql`'instructor' = ANY(${userTable.roles})`,
						eq(userTable.active, true)
					)
		)
		.orderBy(userTable.name);
	return rows.map(toInstructor);
}

export async function getInstructor(id: string): Promise<Instructor | undefined> {
	const [row] = await db.select().from(userTable).where(eq(userTable.id, id));
	if (!row) return undefined;
	return toInstructor(row);
}

export async function updateInstructorProfile(
	id: string,
	input: { phone?: string | null; bio?: string | null; active?: boolean }
): Promise<Instructor> {
	const [row] = await db
		.update(userTable)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(userTable.id, id))
		.returning();
	return toInstructor(row);
}
