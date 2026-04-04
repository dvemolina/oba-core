import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const allEvents = await db.select().from(events).orderBy(desc(events.startDate));
	return { events: allEvents };
};
