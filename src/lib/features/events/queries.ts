// src/lib/features/events/queries.ts
import { and, gte, lte, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import type { CalendarEvent, CreateEventInput } from './types';

export async function listEventsForDateRange(from: string, to: string): Promise<CalendarEvent[]> {
	const rows = await db
		.select()
		.from(events)
		.where(and(lte(events.startDate, to), gte(events.endDate, from)))
		.orderBy(events.startDate);
	return rows as CalendarEvent[];
}

export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
	const [row] = await db.select().from(events).where(eq(events.id, id));
	return row as CalendarEvent | undefined;
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
	const [row] = await db.insert(events).values(input).returning();
	return row as CalendarEvent;
}

export async function updateEvent(
	id: string,
	input: Partial<CreateEventInput>
): Promise<CalendarEvent> {
	const [row] = await db
		.update(events)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(events.id, id))
		.returning();
	return row as CalendarEvent;
}

export async function deleteEvent(id: string): Promise<void> {
	await db.delete(events).where(eq(events.id, id));
}
