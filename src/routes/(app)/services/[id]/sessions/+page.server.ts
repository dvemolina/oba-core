import { error, fail } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import {
	listSessionsForService,
	listEnrollmentsForSession,
	listUnassignedEnrollments,
	assignBookingToSession,
	createSession,
	updateSession,
	cancelSession,
	deleteSession
} from '$lib/features/sessions/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { requireRole } from '$lib/server/permissions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const m = service.modules ?? {};
	if (!('sessions' in m) || !('roster' in m) || 'editions' in m) {
		error(404, 'Sessions page not available for this service type');
	}

	const from = url.searchParams.get('from') ?? undefined;
	const to   = url.searchParams.get('to')   ?? undefined;

	const [sessions, instructors] = await Promise.all([
		listSessionsForService(params.id, from, to),
		listInstructors()
	]);

	// Enrolled bookings per session
	const enrollmentsBySession: Record<string, Awaited<ReturnType<typeof listEnrollmentsForSession>>> = {};
	await Promise.all(
		sessions.map(async s => {
			enrollmentsBySession[s.id] = await listEnrollmentsForSession(s.id);
		})
	);

	// Unassigned enrollments per date
	const sessionDates = [...new Set(sessions.map(s => s.date))];
	const unassignedByDate: Record<string, Awaited<ReturnType<typeof listUnassignedEnrollments>>> = {};
	await Promise.all(
		sessionDates.map(async date => {
			const u = await listUnassignedEnrollments(params.id, date);
			if (u.length > 0) unassignedByDate[date] = u;
		})
	);

	return { service, sessions, instructors, enrollmentsBySession, unassignedByDate };
};

export const actions: Actions = {
	addSession: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const date = form.get('date')?.toString();
		if (!date) return fail(400, { error: 'date required' });
		await createSession({
			ownerType: 'service',
			serviceId: params.id,
			date,
			time: form.get('time')?.toString() || undefined,
			durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
			instructorIds: form.getAll('instructorId').map(String).filter(Boolean),
			notes: form.get('notes')?.toString() || undefined
		});
		return { error: null, message: 'Sesión añadida' };
	},

	updateSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const id = form.get('sessionId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'sessionId required' });
		await updateSession(id, {
			time: form.get('time')?.toString() || null,
			durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : null,
			notes: form.get('notes')?.toString() || null,
			instructorIds: form.getAll('instructorId').map(String).filter(Boolean)
		});
		return { error: null, message: 'Sesión actualizada' };
	},

	cancelSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const id = form.get('sessionId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'sessionId required' });
		await cancelSession(id);
		return { error: null, message: 'Sesión cancelada' };
	},

	deleteSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const id = form.get('sessionId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'sessionId required' });
		await deleteSession(id);
		return { error: null, message: 'Sesión eliminada' };
	},

	assignBookingToSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingId = form.get('bookingId')?.toString() ?? '';
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!bookingId || !sessionId) return fail(400, { error: 'bookingId and sessionId required' });
		try {
			await assignBookingToSession(bookingId, sessionId);
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		return { error: null, message: 'Cliente asignado a sesión' };
	},

	unassignFromSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingId = form.get('bookingId')?.toString() ?? '';
		if (!bookingId) return fail(400, { error: 'bookingId required' });
		await assignBookingToSession(bookingId, null);
		return { error: null, message: 'Cliente desasignado' };
	}
};
