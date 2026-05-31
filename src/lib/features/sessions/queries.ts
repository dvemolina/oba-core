import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sessions, sessionInstructors, instructors, bookings, services } from '$lib/server/db/schema';
import type { CreateSessionInput, Session, UpdateSessionInput } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function attachInstructors(sessionRows: Omit<Session, 'instructors'>[]): Promise<Session[]> {
	if (sessionRows.length === 0) return [];
	const ids = sessionRows.map(s => s.id);

	// Fetch all instructors for these sessions
	const instrRows = await db
		.select({
			id: sessionInstructors.id,
			sessionId: sessionInstructors.sessionId,
			instructorId: sessionInstructors.instructorId,
			instructorName: instructors.name
		})
		.from(sessionInstructors)
		.leftJoin(instructors, eq(sessionInstructors.instructorId, instructors.id))
		.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);

	const bySession: Record<string, typeof instrRows> = {};
	for (const row of instrRows) {
		(bySession[row.sessionId] ??= []).push(row);
	}

	return sessionRows.map(s => ({
		...s,
		instructors: (bySession[s.id] ?? []).map(r => ({
			id: r.id,
			sessionId: r.sessionId,
			instructorId: r.instructorId,
			instructorName: r.instructorName
		}))
	}));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listSessionsForBooking(bookingId: string): Promise<Session[]> {
	const rows = await db
		.select()
		.from(sessions)
		.where(eq(sessions.bookingId, bookingId))
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);
	return attachInstructors(rows as Omit<Session, 'instructors'>[]);
}

/** Returns sessions (with booking context) for a given date. Used by the day view. */
export async function listSessionsForDate(date: string): Promise<(Session & {
	bookingId: string;
	serviceName: string | null;
	serviceColor: string | null;
	serviceHasSessions: boolean;
})[]> {
	const rows = await db
		.select({
			id: sessions.id,
			bookingId: sessions.bookingId,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			sortOrder: sessions.sortOrder,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt,
			serviceName: services.name,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions
		})
		.from(sessions)
		.leftJoin(bookings, eq(sessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(and(eq(sessions.date, date), ne(sessions.status, 'cancelled')))
		.orderBy(sessions.sortOrder, sessions.time);

	const withInstructors = await attachInstructors(
		rows.map(r => ({ ...r, bookingId: r.bookingId, serviceName: r.serviceName, serviceColor: r.serviceColor, serviceHasSessions: r.serviceHasSessions ?? false } as any))
	);

	return withInstructors as any;
}

/** All unscheduled sessions for upcoming bookings (time IS NULL, not cancelled). */
export async function listUnscheduledSessions(from: string, to: string): Promise<(Session & {
	serviceName: string | null;
	serviceColor: string | null;
})[]> {
	const rows = await db
		.select({
			id: sessions.id,
			bookingId: sessions.bookingId,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			sortOrder: sessions.sortOrder,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt,
			serviceName: services.name,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions
		})
		.from(sessions)
		.leftJoin(bookings, eq(sessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(and(
			eq(sessions.status, 'unscheduled'),
			gte(sessions.date, from),
			lte(sessions.date, to)
		))
		.orderBy(sessions.date, sessions.sortOrder);

	return attachInstructors(rows as any) as any;
}

export async function getSession(id: string): Promise<Session | undefined> {
	const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
	if (!row) return undefined;
	const [withInstructor] = await attachInstructors([row as Omit<Session, 'instructors'>]);
	return withInstructor;
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
	const [row] = await db.insert(sessions).values({
		bookingId: input.bookingId,
		date: input.date,
		time: input.time,
		notes: input.notes,
		status: input.time ? 'scheduled' : 'unscheduled',
		sortOrder: input.sortOrder ?? 0
	}).returning();

	if (input.instructorIds?.length) {
		await db.insert(sessionInstructors).values(
			input.instructorIds.map(instructorId => ({
				sessionId: row.id,
				instructorId
			}))
		);
	}

	return (await getSession(row.id))!;
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session> {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (input.date !== undefined)    updates.date = input.date;
	if (input.time !== undefined)    { updates.time = input.time; updates.status = input.time ? 'scheduled' : 'unscheduled'; }
	if (input.notes !== undefined)   updates.notes = input.notes;
	if (input.status !== undefined)  updates.status = input.status;
	if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

	await db.update(sessions).set(updates).where(eq(sessions.id, id));

	// Replace instructors if provided
	if (input.instructorIds !== undefined) {
		await db.delete(sessionInstructors).where(eq(sessionInstructors.sessionId, id));
		if (input.instructorIds.length > 0) {
			await db.insert(sessionInstructors).values(
				input.instructorIds.map(instructorId => ({ sessionId: id, instructorId }))
			);
		}
	}

	return (await getSession(id))!;
}

export async function deleteSession(id: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, id));
}

export async function cancelSession(id: string): Promise<void> {
	await db.update(sessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(sessions.id, id));
}
