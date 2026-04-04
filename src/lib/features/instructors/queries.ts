import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import type { CreateInstructorInput, Instructor, UpdateInstructorInput } from './types';

export async function listInstructors(includeInactive = false): Promise<Instructor[]> {
	const rows = await db
		.select()
		.from(instructors)
		.where(includeInactive ? undefined : eq(instructors.active, true))
		.orderBy(instructors.name);
	return rows as Instructor[];
}

export async function getInstructor(id: string): Promise<Instructor | undefined> {
	const [row] = await db.select().from(instructors).where(eq(instructors.id, id));
	return row as Instructor | undefined;
}

export async function createInstructor(input: CreateInstructorInput): Promise<Instructor> {
	const [row] = await db.insert(instructors).values(input).returning();
	return row as Instructor;
}

export async function updateInstructor(id: string, input: UpdateInstructorInput): Promise<Instructor> {
	const [row] = await db
		.update(instructors)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(instructors.id, id))
		.returning();
	return row as Instructor;
}
