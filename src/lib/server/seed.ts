import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
const DATABASE_URL = process.env.DATABASE_URL;
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const ORIGIN = process.env.ORIGIN;

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (!BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
if (!ORIGIN) throw new Error('ORIGIN is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true }
});

const owners = [
	{ email: 'owner1@example.com', password: 'change-me-owner-1', name: 'Cris' },
	{ email: 'owner2@example.com', password: 'change-me-owner-2', name: 'Patri' }
];

async function seed() {
	console.log('Seeding owner accounts…');

	for (const owner of owners) {
		try {
			await auth.api.signUpEmail({ body: owner });
			console.log(`✓ Created: ${owner.email}`);
		} catch {
			console.log(`– Skipped (may already exist): ${owner.email}`);
		}
	}

	console.log('Done. Change passwords after first login.');
	await client.end();
	process.exit(0);
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
