// Run once after schema migration: npx tsx src/lib/server/db/migrate-modules.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { services, bookingClients, bookingParticipants } from './schema'
import type { ServiceModules } from '$lib/features/services/modules'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL not set')

const client = postgres(connectionString)
const db = drizzle(client)

// Mapping based on production data snapshot 2026-06-13
const SERVICE_MODULES: Record<string, ServiceModules> = {
	'Clase grupal':                 { roster: {}, sessions: {}, inventory: { perParticipant: true }, instructor: { required: true } },
	'Clase Privada':                { sessions: { durationMinutes: 90 }, inventory: { perParticipant: true }, instructor: { required: true } },
	'Bono 5x clases surf grupales': { credits: { creditsIncluded: 5, validityMode: 'range', compatibleServiceIds: [] } },
	'Bono 5x clases surf privadas': { credits: { creditsIncluded: 5, validityMode: 'range', compatibleServiceIds: [] } },
	'Neopreno Medio dia':           { inventory: { perParticipant: true } },
	'Tabla Surf Medio Día':         { inventory: { perParticipant: true } },
	'Tabla + Neopreno Medio Día':   { inventory: { perParticipant: true } },
	'Neopreno Día entero':          { inventory: { perParticipant: true } },
	'Tabla Día entero':             { inventory: { perParticipant: true } },
	'Tabla + Neopreno Día entero':  { inventory: { perParticipant: true } },
	'Helena Kazmier Collab':        { roster: {}, editions: {}, sessions: {}, inventory: { perParticipant: true }, instructor: { required: true } },
	'Collab Rebelarte':             { roster: {}, editions: {}, sessions: {}, instructor: { required: true } },
	'Tipiti Surf camp':             { roster: {}, editions: {}, sessions: {}, inventory: { perParticipant: true }, instructor: { required: true } },
}

async function main() {
	console.log('=== Migrating service modules ===')
	const allServices = await db.select({ id: services.id, name: services.name }).from(services)

	for (const svc of allServices) {
		const modules = SERVICE_MODULES[svc.name]
		if (!modules) {
			console.warn(`  ⚠ No mapping for: "${svc.name}" — setting {}`)
			await db.update(services).set({ modules: {} }).where(eq(services.id, svc.id))
			continue
		}
		await db.update(services).set({ modules }).where(eq(services.id, svc.id))
		console.log(`  ✓ ${svc.name}`)
	}

	console.log('\n=== Migrating booking_clients.participant_count ===')
	await db.update(bookingClients).set({ participantCount: 1 })
	console.log('  ✓ All booking_clients.participant_count set to 1')

	console.log('\n=== Migrating booking_participants.booking_client_id ===')
	// booking_participants has booking_id_temp (old column kept for migration).
	// Find the booking_client for each participant and set booking_client_id.
	const result = await client`
		UPDATE booking_participants bp
		SET booking_client_id = (
			SELECT bc.id FROM booking_clients bc
			WHERE bc.booking_id = bp.booking_id_temp
			LIMIT 1
		)
		WHERE bp.booking_client_id IS NULL
		  AND bp.booking_id_temp IS NOT NULL
	`
	console.log(`  ✓ ${result.count} booking_participants updated`)

	console.log('\n=== Done ===')
	await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
