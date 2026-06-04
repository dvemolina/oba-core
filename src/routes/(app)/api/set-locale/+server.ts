import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const locale = url.searchParams.get('locale') ?? 'es';
	const from = url.searchParams.get('from') ?? '/';

	if (locale === 'es' || locale === 'en') {
		cookies.set('PARAGLIDE_LOCALE', locale, {
			path: '/',
			maxAge: 34560000,
			sameSite: 'lax',
			httpOnly: false  // must be readable by Paraglide's client-side cookie strategy
		});
	}

	redirect(302, from);
};
