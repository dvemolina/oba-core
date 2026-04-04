import { listClients } from '$lib/features/clients/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') ?? undefined;
	const clients = await listClients(search);
	return { clients, search };
};
