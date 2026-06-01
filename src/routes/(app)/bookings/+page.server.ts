import { listAllBookings } from '$lib/features/bookings/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const bookings = await listAllBookings();
	return { bookings };
};
