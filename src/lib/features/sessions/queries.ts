import { and, eq, gte, inArray, lte, ne, sql, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sessions,
	bookingSessions,
	sessionInstructors,
	sessionParticipants,
	bookings,
	bookingClients,
	clients,
	services
} from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import type {
	AgendaSession,
	CreateParticipantInput,
	CreateSessionInput,
	Session,
	SessionForDay,
	SessionParticipant,
	SessionInstructor,
	UpdateSessionInput
} from './types';

// ── Internal helpers ─────────────────────────────────────────────────────────

async function attachInstructors<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { instructors: SessionInstructor[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, instructors: [] }));

	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionInstructors.id,
			sessionId: sessionInstructors.sessionId,
			instructorId: sessionInstructors.instructorId,
			instructorName: userTable.name
		})
		.from(sessionInstructors)
		.leftJoin(userTable, eq(sessionInstructors.instructorId, userTable.id))
		.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);

	const bySession: Record<string, typeof rows> = {};
	for (const row of rows) {
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

async function attachParticipants<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { participants: SessionParticipant[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, participants: [] }));

	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionParticipants.id,
			sessionId: sessionParticipants.sessionId,
			name: sessionParticipants.name,
			notes: sessionParticipants.notes,
			sortOrder: sessionParticipants.sortOrder
		})
		.from(sessionParticipants)
		.where(sql`${sessionParticipants.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`)
		.orderBy(sessionParticipants.sortOrder);

	const bySession: Record<string, SessionParticipant[]> = {};
	for (const r of rows) {
		(bySession[r.sessionId] ??= []).push(r);
	}
	return sessionRows.map(s => ({ ...s, participants: bySession[s.id] ?? [] }));
}

// ── Core CRUD ────────────────────────────────────────────────────────────────

/** All sessions linked to a booking, ordered by date then sortOrder. */
export async function listSessionsForBooking(bookingId: string): Promise<Session[]> {
	const rows = await db
		.select({
			id: sessions.id,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			durationMinutes: sessions.durationMinutes,
		sortOrder: sessions.sortOrder,
			skillLevel: sessions.skillLevel,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt
		})
		.from(sessions)
		.innerJoin(bookingSessions, eq(bookingSessions.sessionId, sessions.id))
		.where(eq(bookingSessions.bookingId, bookingId))
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);

	const withInstructors = await attachInstructors(rows as Omit<Session, 'instructors' | 'participants'>[]);
	return attachParticipants(withInstructors);
}

/** Sessions (with booking context) for a given date. Used by the calendar day view. */
export async function listSessionsForDate(date: string, instructorId?: string): Promise<SessionForDay[]> {
	// Step 1: sessions for this date (not cancelled)
	const sessionRows = await db
		.select({
			id: sessions.id,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			durationMinutes: sessions.durationMinutes,
		sortOrder: sessions.sortOrder,
			skillLevel: sessions.skillLevel,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt
		})
		.from(sessions)
		.where(
			instructorId
				? and(
						eq(sessions.date, date),
						ne(sessions.status, 'cancelled'),
						sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`
					)
				: and(eq(sessions.date, date), ne(sessions.status, 'cancelled'))
		)
		.orderBy(sessions.sortOrder, sessions.time);

	if (sessionRows.length === 0) return [];

	const sessionIds = sessionRows.map(r => r.id);

	// Step 2: all booking links for these sessions
	const links = await db
		.select({
			sessionId: bookingSessions.sessionId,
			bookingId: bookingSessions.bookingId,
			serviceName: services.name,
			serviceColor: services.color,
			serviceHasSessions: services.hasSessions,
			serviceDurationMinutes: services.durationMinutes,
			bookingStatus: bookings.status
		})
		.from(bookingSessions)
		.leftJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(and(
			sql`${bookingSessions.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
			ne(bookings.status, 'cancelled')
		));

	// Step 3: enrolled clients for linked bookings
	const bookingIds = [...new Set(links.map(l => l.bookingId).filter(Boolean))] as string[];
	const clientRows = bookingIds.length > 0
		? await db
			.select({
				bookingId: bookingClients.bookingId,
				firstName: clients.firstName,
				lastName: clients.lastName
			})
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, bookingIds), eq(bookingClients.status, 'enrolled')))
		: [];

	// Step 4: payment totals per booking
	const paymentRows = bookingIds.length > 0
		? await db
			.select({
				bookingId: bookingClients.bookingId,
				totalDue: sum(bookingClients.amountDue),
				totalPaid: sum(bookingClients.amountPaid)
			})
			.from(bookingClients)
			.where(and(inArray(bookingClients.bookingId, bookingIds), eq(bookingClients.status, 'enrolled')))
			.groupBy(bookingClients.bookingId)
		: [];

	const paymentByBooking: Record<string, { due: number; paid: number }> = {};
	for (const r of paymentRows) {
		paymentByBooking[r.bookingId] = {
			due: parseFloat(r.totalDue ?? '0') || 0,
			paid: parseFloat(r.totalPaid ?? '0') || 0
		};
	}

	// Index by session
	const linksBySession: Record<string, typeof links> = {};
	for (const l of links) {
		(linksBySession[l.sessionId] ??= []).push(l);
	}
	const clientsByBooking: Record<string, string[]> = {};
	for (const r of clientRows) {
		(clientsByBooking[r.bookingId] ??= []).push(`${r.firstName} ${r.lastName}`);
	}

	const withInstructors = await attachInstructors(sessionRows as Omit<Session, 'instructors' | 'participants'>[]);
	const withBoth = await attachParticipants(withInstructors);

	return withBoth
		.filter(s => (linksBySession[s.id] ?? []).length > 0)
		.map(s => {
			const sl = linksBySession[s.id]!;
			const firstLink = sl[0];
			const allClientNames = sl.flatMap(l => clientsByBooking[l.bookingId] ?? []);
			const svcDuration = firstLink.serviceDurationMinutes ?? null;

			// Prefer explicit session_participants; fall back to booking client names
			const participantNames = s.participants.length > 0
				? s.participants.map(p => p.name)
				: allClientNames;

			// Aggregate payment totals across all bookings for this session
			const totalAmountDue = sl.reduce((sum, l) => sum + (paymentByBooking[l.bookingId]?.due ?? 0), 0);
			const totalAmountPaid = sl.reduce((sum, l) => sum + (paymentByBooking[l.bookingId]?.paid ?? 0), 0);

			return {
				...s,
				bookingId: firstLink.bookingId ?? '',
				bookingIds: sl.map(l => l.bookingId),
				bookingStatus: firstLink.bookingStatus ?? 'pending',
				serviceName: firstLink.serviceName ?? null,
				serviceColor: firstLink.serviceColor ?? null,
				serviceHasSessions: firstLink.serviceHasSessions ?? false,
				serviceDurationMinutes: svcDuration,
				effectiveDuration: s.durationMinutes ?? svcDuration ?? 60,
				participantNames,
				totalParticipants: participantNames.length,
				totalAmountDue,
				totalAmountPaid
			} satisfies SessionForDay;
		});
}

/** Unscheduled sessions linked to any booking in [from, to]. */
export async function listUnscheduledSessions(from: string, to: string): Promise<(Session & {
	bookingId: string;
	serviceName: string | null;
	serviceColor: string | null;
})[]> {
	const sessionRows = await db
		.select({
			id: sessions.id,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			durationMinutes: sessions.durationMinutes,
		sortOrder: sessions.sortOrder,
			skillLevel: sessions.skillLevel,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt
		})
		.from(sessions)
		.where(and(eq(sessions.status, 'unscheduled'), gte(sessions.date, from), lte(sessions.date, to)))
		.orderBy(sessions.date, sessions.sortOrder);

	if (sessionRows.length === 0) return [];

	const sessionIds = sessionRows.map(r => r.id);
	const links = await db
		.select({
			sessionId: bookingSessions.sessionId,
			bookingId: bookingSessions.bookingId,
			serviceName: services.name,
			serviceColor: services.color
		})
		.from(bookingSessions)
		.leftJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(
			sql`${bookingSessions.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`
		);

	const linksBySession: Record<string, typeof links[0]> = {};
	for (const l of links) {
		if (!linksBySession[l.sessionId]) linksBySession[l.sessionId] = l;
	}

	const withInstructors = await attachInstructors(sessionRows as Omit<Session, 'instructors'>[]);

	return withInstructors.map(s => ({
		...s,
		bookingId: linksBySession[s.id]?.bookingId ?? '',
		serviceName: linksBySession[s.id]?.serviceName ?? null,
		serviceColor: linksBySession[s.id]?.serviceColor ?? null
	}));
}

export async function getSession(id: string): Promise<Session | undefined> {
	const [row] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, id));
	if (!row) return undefined;
	const [withInstructors] = await attachInstructors([row as Omit<Session, 'instructors' | 'participants'>]);
	const [withBoth] = await attachParticipants([withInstructors]);
	return withBoth;
}

/** Create a session and automatically link it to bookingId via the junction table. */
export async function createSession(input: CreateSessionInput): Promise<Session> {
	const [row] = await db.insert(sessions).values({
		date: input.date,
		time: input.time,
		durationMinutes: input.durationMinutes,
		notes: input.notes,
		status: input.time ? 'scheduled' : 'unscheduled',
		sortOrder: input.sortOrder ?? 0,
		skillLevel: input.skillLevel ?? null
	}).returning();

	// Link to booking via junction
	await db.insert(bookingSessions).values({
		sessionId: row.id,
		bookingId: input.bookingId
	});

	// Assign instructors
	if (input.instructorIds?.length) {
		await db.insert(sessionInstructors).values(
			input.instructorIds.map(instructorId => ({ sessionId: row.id, instructorId }))
		);
	}

	return (await getSession(row.id))!;
}

export async function updateSession(id: string, input: UpdateSessionInput): Promise<Session> {
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (input.date !== undefined)      updates.date = input.date;
	if (input.time !== undefined)      { updates.time = input.time; updates.status = input.time ? 'scheduled' : 'unscheduled'; }
	if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
	if (input.notes !== undefined)     updates.notes = input.notes;
	if (input.status !== undefined)    updates.status = input.status;
	if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
	if (input.skillLevel !== undefined) updates.skillLevel = input.skillLevel;

	await db.update(sessions).set(updates).where(eq(sessions.id, id));

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

export async function cancelSession(id: string): Promise<void> {
	await db.update(sessions).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
	// bookingSessions rows cascade-deleted via FK
	await db.delete(sessions).where(eq(sessions.id, id));
}

/** Delete all sessions linked to a booking (used by bulk regenerate). */
export async function deleteSessionsForBooking(bookingId: string): Promise<void> {
	// Get session IDs linked to this booking
	const links = await db
		.select({ sessionId: bookingSessions.sessionId })
		.from(bookingSessions)
		.where(eq(bookingSessions.bookingId, bookingId));

	if (links.length === 0) return;

	const ids = links.map(l => l.sessionId);
	// Only delete sessions that have no OTHER booking links (don't delete shared sessions)
	for (const sessionId of ids) {
		const otherLinks = await db
			.select({ id: bookingSessions.id })
			.from(bookingSessions)
			.where(and(eq(bookingSessions.sessionId, sessionId), ne(bookingSessions.bookingId, bookingId)))
			.limit(1);

		if (otherLinks.length === 0) {
			// Safe to delete: session belongs only to this booking
			await db.delete(sessions).where(eq(sessions.id, sessionId));
		} else {
			// Shared session — only unlink, don't delete the session itself
			await db.delete(bookingSessions).where(
				and(eq(bookingSessions.sessionId, sessionId), eq(bookingSessions.bookingId, bookingId))
			);
		}
	}
}

// ── Multi-booking session linking ────────────────────────────────────────────
// These enable the scheduling board feature: assign multiple bookings to one session.

/** Link an existing session to an additional booking. No-ops if already linked. */
export async function linkSessionToBooking(sessionId: string, bookingId: string): Promise<void> {
	await db.insert(bookingSessions).values({ sessionId, bookingId }).onConflictDoNothing();
}

/** Remove a booking's link to a session. Does NOT delete the session itself. */
export async function unlinkSessionFromBooking(sessionId: string, bookingId: string): Promise<void> {
	await db.delete(bookingSessions).where(
		and(eq(bookingSessions.sessionId, sessionId), eq(bookingSessions.bookingId, bookingId))
	);
}

// ── Session participants ──────────────────────────────────────────────────────

export async function listParticipantsForSession(sessionId: string): Promise<SessionParticipant[]> {
	return db
		.select({
			id: sessionParticipants.id,
			sessionId: sessionParticipants.sessionId,
			name: sessionParticipants.name,
			notes: sessionParticipants.notes,
			sortOrder: sessionParticipants.sortOrder
		})
		.from(sessionParticipants)
		.where(eq(sessionParticipants.sessionId, sessionId))
		.orderBy(sessionParticipants.sortOrder);
}

export async function addParticipant(input: CreateParticipantInput): Promise<SessionParticipant> {
	const [row] = await db
		.insert(sessionParticipants)
		.values({
			id: crypto.randomUUID(),
			sessionId: input.sessionId,
			name: input.name.trim(),
			notes: input.notes ?? null,
			sortOrder: input.sortOrder ?? 0
		})
		.returning();
	return row;
}

export async function removeParticipant(participantId: string): Promise<void> {
	await db.delete(sessionParticipants).where(eq(sessionParticipants.id, participantId));
}

// ── Agenda query ─────────────────────────────────────────────────────────────

/** Sessions with full booking/client context for the Agenda view. */
export async function listSessionsForDateRange(from: string, to: string, instructorId?: string): Promise<AgendaSession[]> {
	const sessionRows = await db
		.select({
			id: sessions.id,
			date: sessions.date,
			time: sessions.time,
			notes: sessions.notes,
			status: sessions.status,
			durationMinutes: sessions.durationMinutes,
		sortOrder: sessions.sortOrder,
			skillLevel: sessions.skillLevel,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt
		})
		.from(sessions)
		.where(
			instructorId
				? and(
						gte(sessions.date, from),
						lte(sessions.date, to),
						ne(sessions.status, 'cancelled'),
						sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`
					)
				: and(gte(sessions.date, from), lte(sessions.date, to), ne(sessions.status, 'cancelled'))
		)
		.orderBy(sessions.date, sessions.sortOrder, sessions.time);

	if (sessionRows.length === 0) return [];

	const sessionIds = sessionRows.map(r => r.id);

	// All booking links with service/booking context
	const links = await db
		.select({
			sessionId: bookingSessions.sessionId,
			bookingId: bookingSessions.bookingId,
			serviceName: services.name,
			serviceColor: services.color,
			serviceHasRoster: services.hasRoster,
			serviceHasSessions: services.hasSessions,
			serviceMaxCapacity: services.maxCapacity,
			serviceDurationMinutes: services.durationMinutes,
			sessionsIncluded: bookings.sessionsIncluded,
			bookingStatus: bookings.status,
			bookingDate: bookings.date,
			bookingDateEnd: bookings.dateEnd,
			isFlexible: bookings.isFlexible
		})
		.from(bookingSessions)
		.leftJoin(bookings, eq(bookingSessions.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(
			and(
				sql`${bookingSessions.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`,
				ne(bookings.status, 'cancelled')
			)
		);

	// Enrolled clients for all linked bookings
	const bookingIds = [...new Set(links.map(l => l.bookingId).filter(Boolean))] as string[];
	const clientRows = bookingIds.length > 0
		? await db
			.select({
				bookingId: bookingClients.bookingId,
				firstName: clients.firstName,
				lastName: clients.lastName,
				phone: clients.phone,
				amountDue: bookingClients.amountDue,
				amountPaid: bookingClients.amountPaid
			})
			.from(bookingClients)
			.leftJoin(clients, eq(bookingClients.clientId, clients.id))
			.where(and(inArray(bookingClients.bookingId, bookingIds), eq(bookingClients.status, 'enrolled')))
		: [];

	const linksBySession: Record<string, typeof links> = {};
	for (const l of links) (linksBySession[l.sessionId] ??= []).push(l);

	const clientsByBooking: Record<string, typeof clientRows> = {};
	for (const r of clientRows) (clientsByBooking[r.bookingId] ??= []).push(r);

	const withInstructors = await attachInstructors(sessionRows as Omit<Session, 'instructors' | 'participants'>[]);
	const withBoth = await attachParticipants(withInstructors);

	// Sessions with no active booking links (all linked bookings cancelled) get filtered
	return withBoth
		.filter(s => (linksBySession[s.id] ?? []).length > 0)
		.map(s => {
			const sl = linksBySession[s.id]!;
			const first = sl[0];
			const bClients = sl.flatMap(l => clientsByBooking[l.bookingId] ?? []);
			const svcDuration = first.serviceDurationMinutes ?? null;

			const participantNames = s.participants.length > 0
				? s.participants.map(p => p.name)
				: first.serviceHasRoster
					? []
					: bClients.map(c => `${c.firstName} ${c.lastName}`);

			return {
				...s,
				bookingId: first.bookingId ?? '',
				bookingIds: sl.map(l => l.bookingId).filter(Boolean) as string[],
				serviceName: first.serviceName,
				serviceColor: first.serviceColor,
				serviceHasRoster: first.serviceHasRoster ?? false,
				serviceDurationMinutes: svcDuration,
				effectiveDuration: s.durationMinutes ?? svcDuration ?? 60,
				sessionsIncluded: first.sessionsIncluded,
				bookingStatus: first.bookingStatus ?? 'pending',
				bookingDate: first.bookingDate ?? s.date,
				bookingDateEnd: first.bookingDateEnd,
				isFlexible: first.isFlexible ?? false,
				participantNames,
				enrolledCount: bClients.length,
				maxCapacity: first.serviceMaxCapacity,
				totalAmountDue: bClients.reduce((sum, c) => sum + parseFloat(c.amountDue ?? '0'), 0),
				totalAmountPaid: bClients.reduce((sum, c) => sum + parseFloat(c.amountPaid ?? '0'), 0)
			} satisfies AgendaSession;
		});
}
