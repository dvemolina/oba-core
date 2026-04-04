import { listInstructors } from '$lib/features/instructors/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const instructors = await listInstructors(true);
	return { instructors };
};
