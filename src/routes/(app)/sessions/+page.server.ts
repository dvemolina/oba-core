import { listSessionsForDateRange } from '$lib/features/sessions/queries';
import { getTodayString } from '$lib/features/calendar/utils';
import { requireRole } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals, 'admin', 'owner', 'manager');

	const today = getTodayString();
	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const serviceFilter = url.searchParams.get('service') ?? '';

	const from = fromParam ?? today;
	// Default: next 30 days
	const toDefault = new Date(today + 'T00:00:00');
	toDefault.setDate(toDefault.getDate() + 29);
	const to = toParam ?? toDefault.toISOString().slice(0, 10);

	const sessions = await listSessionsForDateRange(from, to);

	const filtered = serviceFilter
		? sessions.filter(s => s.serviceName?.toLowerCase().includes(serviceFilter.toLowerCase()))
		: sessions;

	// Group by date
	const byDate: Record<string, typeof filtered> = {};
	for (const s of filtered) (byDate[s.date] ??= []).push(s);

	const uniqueServices = [...new Set(sessions.map(s => s.serviceName).filter(Boolean))].sort();

	return { byDate, from, to, serviceFilter, uniqueServices };
};
