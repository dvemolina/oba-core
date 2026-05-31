import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) error(400, 'Invalid date');
	redirect(301, `/calendar?view=day&date=${params.date}`);
};
