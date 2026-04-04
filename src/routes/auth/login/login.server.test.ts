import { describe, it, expect } from 'vitest';

describe('login page load', () => {
	it('redirects authenticated users to /calendar', async () => {
		const { load } = await import('./+page.server');
		const user = { id: '1', email: 'owner@oba.surf', name: 'Owner' };

		await expect(
			load({ locals: { user, session: {} } } as any)
		).rejects.toMatchObject({ status: 302, location: '/calendar' });
	});

	it('returns empty object for unauthenticated users', async () => {
		const { load } = await import('./+page.server');
		const result = await load({ locals: { user: undefined, session: undefined } } as any);
		expect(result).toEqual({});
	});
});
