import { error, fail } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { listEditionsForService } from '$lib/features/services/editions.queries';
import { listBookingsForRun, recalcEditionBookingAmounts } from '$lib/features/bookings/queries';
import { requireRole } from '$lib/server/permissions';
import {
	listSessionsForEdition,
	createSession,
	cancelSession,
	deleteSession,
	bulkGenerateSessionsForEdition
} from '$lib/features/sessions/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { Actions, PageServerLoad } from './$types';
import type { BulkGenOptions } from '$lib/features/sessions/types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const editions = await listEditionsForService(params.id);
	const focusEditionId = url.searchParams.get('run') ?? editions[0]?.id ?? null;

	const bookingsByEdition: Record<string, Awaited<ReturnType<typeof listBookingsForRun>>> = {};
	await Promise.all(
		editions.map(async edition => {
			bookingsByEdition[edition.id] = await listBookingsForRun(edition.id);
		})
	);

	const [sessionsByEdition, instructors] = await Promise.all([
		(async () => {
			const map: Record<string, Awaited<ReturnType<typeof listSessionsForEdition>>> = {};
			await Promise.all(
				editions.map(async e => {
					map[e.id] = await listSessionsForEdition(e.id);
				})
			);
			return map;
		})(),
		listInstructors()
	]);

	return { service, editions, focusEditionId, bookingsByEdition, sessionsByEdition, instructors };
};

export const actions: Actions = {
	addEditionSession: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const editionId = form.get('editionId')?.toString() ?? '';
		const date      = form.get('date')?.toString() ?? '';
		if (!editionId || !date) return fail(400, { error: 'editionId and date required' });
		await createSession({
			ownerType: 'edition', editionId, date,
			time: form.get('time')?.toString() || undefined,
			durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
			instructorIds: form.getAll('instructorId').map(String).filter(Boolean)
		});
		await recalcEditionBookingAmounts(editionId);
		return { error: null, message: 'Sesión añadida' };
	},

	cancelEditionSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form      = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		const editionId = form.get('editionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'sessionId required' });
		await cancelSession(sessionId);
		if (editionId) await recalcEditionBookingAmounts(editionId);
		return { error: null, message: 'Sesión cancelada' };
	},

	deleteEditionSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form      = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		const editionId = form.get('editionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'sessionId required' });
		await deleteSession(sessionId);
		if (editionId) await recalcEditionBookingAmounts(editionId);
		return { error: null, message: 'Sesión eliminada' };
	},

	bulkGenerateEditionSessions: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form      = await request.formData();
		const editionId = form.get('editionId')?.toString() ?? '';
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate   = form.get('endDate')?.toString() ?? '';
		if (!editionId || !startDate || !endDate) return fail(400, { error: 'Missing required fields' });

		const opts: BulkGenOptions = {
			sessionsPerDay: parseInt(form.get('sessionsPerDay')?.toString() ?? '1'),
			times: form.getAll('sessionTime').map(t => t.toString() || undefined),
			weekdaysOnly: form.get('weekdaysOnly') === 'true',
			durationMinutes: form.get('durationMinutes') ? parseInt(form.get('durationMinutes')!.toString()) : undefined,
			clearExisting: form.get('clearExisting') === 'true'
		};
		await bulkGenerateSessionsForEdition(editionId, { startDate, endDate }, opts);
		await recalcEditionBookingAmounts(editionId);
		return { error: null, message: 'Sesiones generadas' };
	}
};
