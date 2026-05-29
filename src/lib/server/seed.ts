import { createSeedAuthContext, seedAuthUsers } from './auth-seed-users';

async function seed() {
	if (seedAuthUsers.length === 0) {
		throw new Error(
			'Set SEED_OWNER_1_EMAIL and SEED_OWNER_1_PASSWORD before running the seed script.'
		);
	}

	const { client, auth } = createSeedAuthContext();

	console.log('Seeding auth accounts…');

	for (const user of seedAuthUsers) {
		try {
			await auth.api.signUpEmail({ body: user });
			console.log(`✓ Created: ${user.email}`);
		} catch {
			console.log(`– Skipped (may already exist): ${user.email}`);
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
