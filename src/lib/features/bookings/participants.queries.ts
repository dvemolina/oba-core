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

export async function renameParticipant(id: string, name: string): Promise<void> {
	await db.update(bookingParticipants).set({ name }).where(eq(bookingParticipants.id, id));
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

/**
 * Set the exact participant count for a booking.
 * Adds auto-named slots if count > current, removes last slots if count < current.
 * Returns the final participant list.
 */
export async function setParticipantCount(
	bookingId: string,
	count: number
): Promise<BookingParticipant[]> {
	const current = await listParticipantsForBooking(bookingId);

	if (count > current.length) {
		const toAdd = count - current.length;
		await db.insert(bookingParticipants).values(
			Array.from({ length: toAdd }, (_, i) => ({
				bookingId,
				name: `Participant ${current.length + i + 1}`,
				sortOrder: current.length + i
			}))
		);
	} else if (count < current.length) {
		const toRemove = current.slice(count); // last N by sortOrder
		for (const p of toRemove) {
			await db.delete(bookingParticipants).where(eq(bookingParticipants.id, p.id));
		}
	}

	return listParticipantsForBooking(bookingId);
}
