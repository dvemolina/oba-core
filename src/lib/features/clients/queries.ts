// src/lib/features/clients/queries.ts
import { eq, ilike, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clients } from '$lib/server/db/schema';
import type { Client, CreateClientInput, UpdateClientInput } from './types';

export async function listClients(search?: string): Promise<Client[]> {
	const rows = search
		? await db
				.select()
				.from(clients)
				.where(
					or(
						ilike(clients.firstName, `%${search}%`),
						ilike(clients.lastName, `%${search}%`),
						ilike(clients.phone, `%${search}%`)
					)
				)
				.orderBy(clients.lastName, clients.firstName)
		: await db.select().from(clients).orderBy(clients.lastName, clients.firstName);
	return rows as Client[];
}

export async function getClient(id: string): Promise<Client | undefined> {
	const [row] = await db.select().from(clients).where(eq(clients.id, id));
	return row as Client | undefined;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
	const [row] = await db.insert(clients).values(input).returning();
	return row as Client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
	const [row] = await db
		.update(clients)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(clients.id, id))
		.returning();
	return row as Client;
}

export async function searchOrCreateClient(
	firstName: string,
	lastName: string
): Promise<Client> {
	const [existing] = await db
		.select()
		.from(clients)
		.where(or(ilike(clients.firstName, firstName), ilike(clients.lastName, lastName)))
		.limit(1);

	if (existing) return existing as Client;
	return createClient({ firstName, lastName });
}
