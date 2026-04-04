import { listServices } from '$lib/features/services/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const services = await listServices(true); // include inactive for management
	return { services };
};
