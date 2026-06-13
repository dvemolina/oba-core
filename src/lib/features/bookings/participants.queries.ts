import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { bookingParticipants } from '$lib/server/db/schema'
import type { BookingParticipant } from './types'

export async function listParticipantsForEnrollment(bookingClientId: string): Promise<BookingParticipant[]> {
	return db
		.select()
		.from(bookingParticipants)
		.where(eq(bookingParticipants.bookingClientId, bookingClientId))
		.orderBy(bookingParticipants.sortOrder, bookingParticipants.createdAt)
}

export async function addParticipant(
	bookingClientId: string,
	name: string,
	notes?: string | null
): Promise<BookingParticipant> {
	const existing = await listParticipantsForEnrollment(bookingClientId)
	const [row] = await db
		.insert(bookingParticipants)
		.values({ bookingClientId, name, notes: notes ?? null, sortOrder: existing.length })
		.returning()
	return row
}

export async function renameParticipant(id: string, name: string): Promise<void> {
	await db.update(bookingParticipants).set({ name }).where(eq(bookingParticipants.id, id))
}

export async function removeParticipant(id: string): Promise<void> {
	await db.delete(bookingParticipants).where(eq(bookingParticipants.id, id))
}

export async function setEnrollmentParticipantCount(
	bookingClientId: string,
	count: number
): Promise<BookingParticipant[]> {
	const current = await listParticipantsForEnrollment(bookingClientId)

	if (count > current.length) {
		const toAdd = count - current.length
		await db.insert(bookingParticipants).values(
			Array.from({ length: toAdd }, (_, i) => ({
				bookingClientId,
				name: `Participante ${current.length + i + 1}`,
				sortOrder: current.length + i
			}))
		)
	} else if (count < current.length) {
		const toRemove = current.slice(count)
		for (const p of toRemove) {
			await db.delete(bookingParticipants).where(eq(bookingParticipants.id, p.id))
		}
	}

	return listParticipantsForEnrollment(bookingClientId)
}
