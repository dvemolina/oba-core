import { listAllBookings } from '$lib/features/bookings/queries';
import { getTodayString } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const today = getTodayString();

	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const serviceFilter = url.searchParams.get('service') ?? '';
	const statusFilter = url.searchParams.get('status') ?? 'all';

	// Default: today → next 60 days
	const fromDefault = new Date(today + 'T00:00:00');
	const toDefault = new Date(today + 'T00:00:00');
	toDefault.setDate(toDefault.getDate() + 60);

	const from = fromParam ?? fromDefault.toISOString().slice(0, 10);
	const to   = toParam   ?? toDefault.toISOString().slice(0, 10);

	const all = await listAllBookings({ from, to, statusFilter: statusFilter === 'all' ? undefined : statusFilter });

	const filtered = serviceFilter
		? all.filter(b => b.serviceName?.toLowerCase().includes(serviceFilter.toLowerCase()))
		: all;

	const byDate: Record<string, typeof filtered> = {};
	for (const b of filtered) (byDate[b.date] ??= []).push(b);

	const uniqueServices = [...new Set(all.map(b => b.serviceName).filter(Boolean))].sort();

	return { byDate, from, to, serviceFilter, statusFilter, uniqueServices };
};
