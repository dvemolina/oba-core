import { hashPassword } from 'better-auth/crypto';
import { randomBytes } from 'node:crypto';
import { createSeedAuthContext, seedAuthUsers } from './auth-seed-users';

function createId() {
	return randomBytes(24).toString('base64url').slice(0, 32);
}

async function resetAuth() {
	if (seedAuthUsers.length === 0) {
		throw new Error(
			'Set SEED_OWNER_1_EMAIL and SEED_OWNER_1_PASSWORD before running the reset script.'
		);
	}

	const { client } = createSeedAuthContext();

	console.log('Resetting auth accounts…');

	await client.begin(async (sql) => {
		await sql`delete from "verification"`;
		await sql`delete from "session"`;
		await sql`delete from "account"`;
		await sql`delete from "user"`;

		for (const user of seedAuthUsers) {
			const userId = createId();
			const accountId = createId();
			const passwordHash = await hashPassword(user.password);

			await sql`insert into "user" (id, name, email, email_verified, created_at, updated_at)
				values (${userId}, ${user.name}, ${user.email}, false, now(), now())`;

			await sql`insert into "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
				values (${accountId}, ${userId}, ${'credential'}, ${userId}, ${passwordHash}, now(), now())`;

			console.log(`✓ Reset: ${user.email}`);
		}
	});

	await client.end();
	console.log('Done.');
	process.exit(0);
}

resetAuth().catch((err) => {
	console.error('Reset failed:', err);
	process.exit(1);
});
