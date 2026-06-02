import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		const rawRoles = (session.user as Record<string, unknown>).roles as string[] | null | undefined;
		const singleRole = (session.user as Record<string, unknown>).role as string | null | undefined;
		const roles: string[] = rawRoles?.length
			? rawRoles
			: singleRole
				? [singleRole]
				: [];
		event.locals.user = {
			...session.user,
			image: session.user.image ?? null,
			role: session.user.role ?? null,
			roles,
			banned: session.user.banned ?? null,
			banReason: session.user.banReason ?? null,
			banExpires: session.user.banExpires ?? null
		};
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleParaglide, handleBetterAuth);
