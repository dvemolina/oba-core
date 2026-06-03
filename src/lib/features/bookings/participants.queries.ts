import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookingParticipants } from '$lib/server/db/schema';
import type { BookingParticipant } from './types';

export async function listParticipantsForBooking(bookingId: string): Promise<BookingParticipant[]> {
	return db
		.select()
		.from(bookingParticipants)
		.where(eq(bookingParticipants.bookingId, bookingId))
		.orderBy(bookingParticipants.sortOrder, bookingParticipants.createdAt);
}

export async function addBookingParticipant(
	bookingId: string,
	name: string,
	notes?: string | null
): Promise<BookingParticipant> {
	const existing = await listParticipantsForBooking(bookingId);
	const [row] = await db
		.insert(bookingParticipants)
		.values({ bookingId, name, notes: notes ?? null, sortOrder: existing.length })
		.returning();
	return row;
}

export async function removeBookingParticipant(id: string): Promise<void> {
	await db.delete(bookingParticipants).where(eq(bookingParticipants.id, id));
}

export async function bulkAddBookingParticipants(
	bookingId: string,
	names: string[]
): Promise<void> {
	if (names.length === 0) return;
	await db.insert(bookingParticipants).values(
		names.map((name, i) => ({ bookingId, name, sortOrder: i }))
	);
}
