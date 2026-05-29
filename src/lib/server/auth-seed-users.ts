import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

const DATABASE_URL = process.env.DATABASE_URL;
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const ORIGIN = process.env.ORIGIN;
const SEED_OWNER_1_EMAIL = process.env.SEED_OWNER_1_EMAIL;
const SEED_OWNER_1_PASSWORD = process.env.SEED_OWNER_1_PASSWORD;
const SEED_OWNER_1_NAME = process.env.SEED_OWNER_1_NAME ?? 'User 1';
const SEED_OWNER_2_EMAIL = process.env.SEED_OWNER_2_EMAIL;
const SEED_OWNER_2_PASSWORD = process.env.SEED_OWNER_2_PASSWORD;
const SEED_OWNER_2_NAME = process.env.SEED_OWNER_2_NAME ?? 'User 2';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (!BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
if (!ORIGIN) throw new Error('ORIGIN is not set');

export type SeedAuthUser = {
	email: string;
	password: string;
	name: string;
};

export const seedAuthUsers = [
	{ email: SEED_OWNER_1_EMAIL, password: SEED_OWNER_1_PASSWORD, name: SEED_OWNER_1_NAME },
	{ email: SEED_OWNER_2_EMAIL, password: SEED_OWNER_2_PASSWORD, name: SEED_OWNER_2_NAME }
].filter(
	(
		user
	): user is {
		email: string;
		password: string;
		name: string;
	} => Boolean(user.email && user.password)
);

export function createSeedAuthContext() {
	const client = postgres(DATABASE_URL);
	const db = drizzle(client, { schema });
	const auth = betterAuth({
		baseURL: ORIGIN,
		secret: BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg' }),
		emailAndPassword: { enabled: true }
	});

	return { client, auth };
}
