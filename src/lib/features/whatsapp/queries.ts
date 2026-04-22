import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { whatsappSessions } from '$lib/server/db/schema';
import type {
	WhatsappSession,
	UpsertWhatsappSessionInput,
	UpdateWhatsappSessionInput,
	WhatsappSessionState
} from './types';

export async function getSession(whatsappId: string): Promise<WhatsappSession | undefined> {
	const [row] = await db
		.select()
		.from(whatsappSessions)
		.where(eq(whatsappSessions.whatsappId, whatsappId));
	return row as WhatsappSession | undefined;
}

export async function listSessionsByState(state: WhatsappSessionState): Promise<WhatsappSession[]> {
	const rows = await db
		.select()
		.from(whatsappSessions)
		.where(eq(whatsappSessions.state, state));
	return rows as WhatsappSession[];
}

export async function upsertSession(input: UpsertWhatsappSessionInput): Promise<WhatsappSession> {
	const [row] = await db
		.insert(whatsappSessions)
		.values({
			whatsappId: input.whatsappId,
			state: input.state ?? 'IDLE',
			serviceType: input.serviceType ?? null,
			collectedData: input.collectedData ?? null,
			reservationId: input.reservationId ?? null,
			language: input.language ?? 'es'
		})
		.onConflictDoUpdate({
			target: whatsappSessions.whatsappId,
			set: {
				state: input.state ?? 'IDLE',
				serviceType: input.serviceType ?? null,
				collectedData: input.collectedData ?? null,
				reservationId: input.reservationId ?? null,
				language: input.language ?? 'es',
				lastActivity: new Date()
			}
		})
		.returning();
	return row as WhatsappSession;
}

export async function updateSession(
	whatsappId: string,
	input: UpdateWhatsappSessionInput
): Promise<WhatsappSession | undefined> {
	const [row] = await db
		.update(whatsappSessions)
		.set({ ...input, lastActivity: new Date() })
		.where(eq(whatsappSessions.whatsappId, whatsappId))
		.returning();
	return row as WhatsappSession | undefined;
}

export async function deleteSession(whatsappId: string): Promise<void> {
	await db.delete(whatsappSessions).where(eq(whatsappSessions.whatsappId, whatsappId));
}
