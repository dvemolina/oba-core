import { error, fail, redirect } from '@sveltejs/kit';
import {
	cancelBooking,
	deleteBooking,
	getBooking,
	updateBooking,
	updateBookingClientPayment,
	updateBookingClientAmountDue,
	cancelBookingClient,
	reenrollBookingClient,
	addClientToBooking,
	removeClientFromBooking
} from '$lib/features/bookings/queries';
import {
	listSessionsForBooking,
	listSessionsForDate,
	createSession,
	updateSession,
	cancelSession,
	deleteSession,
	deleteSessionsForBooking,
	linkSessionToBooking,
	unlinkSessionFromBooking,
	addParticipant,
	removeParticipant
} from '$lib/features/sessions/queries';
import { addBookingParticipant, removeBookingParticipant } from '$lib/features/bookings/participants.queries';
import { getService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import type { BookingStatus } from '$lib/features/bookings/types';
import type { Actions, PageServerLoad } from './$types';
import { requireRole, canSeeFinancials } from '$lib/server/permissions';
import { listLinksForService } from '$lib/features/inventory/serviceLinks.queries';
import { listItemsByType, getInventoryItemType, checkAvailability } from '$lib/features/inventory/queries';
import { updateAllocation, deleteAllocation, createAllocation } from '$lib/features/inventory/allocations.queries';
import type { AllocationStatus } from '$lib/features/inventory/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const [booking, instructors] = await Promise.all([getBooking(params.id), listInstructors()]);
	if (!booking) error(404, 'Booking not found');

	const isCamp = booking.serviceHasRoster;
	const hasSessions = booking.serviceHasSessions;
	const [service, clients, sessions, allDateSessions] = await Promise.all([
		booking.serviceId ? getService(booking.serviceId) : Promise.resolve(undefined),
		isCamp ? listClients() : Promise.resolve([]),
		hasSessions ? listSessionsForBooking(params.id) : Promise.resolve([]),
		// For "link to existing session": sessions on booking's start date from other bookings
		hasSessions ? listSessionsForDate(booking.date) : Promise.resolve([])
	]);

	// Sessions on the same date not already linked to this booking
	const linkableSessions = allDateSessions.filter(
		s => !sessions.some(owned => owned.id === s.id) && s.status !== 'cancelled'
	);

	const serviceInventoryLinks = service?.hasInventoryUnits ? await listLinksForService(service.id) : [];

	// Load items for all relevant types: existing allocations + service link types (for the add form)
	const allocItemTypeIds = [...new Set([
		...booking.allocations.map(a => a.itemTypeId),
		...serviceInventoryLinks.map(l => l.itemTypeId)
	])];
	const itemsByAllocType: Record<string, Awaited<ReturnType<typeof listItemsByType>>> = {};
	const allocTypeTracking: Record<string, 'pool' | 'specific'> = {};
	await Promise.all(
		allocItemTypeIds.map(async (typeId) => {
			const type = await getInventoryItemType(typeId);
			allocTypeTracking[typeId] = type?.trackingMode ?? 'specific';
			itemsByAllocType[typeId] = type?.trackingMode === 'specific' ? await listItemsByType(typeId) : [];
		})
	);

	return { booking, instructors, service: service ?? null, clients, isCamp, sessions, linkableSessions, allDateSessions, canSeeFinancials: canSeeFinancials(locals), userRole: locals.user?.role ?? '', itemsByAllocType, allocTypeTracking, serviceInventoryLinks };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const newStatus = form.get('status')?.toString() as BookingStatus;
		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Not found' });

		const isSessionBased = booking.serviceHasSessions;
		const priceOverrideRaw = form.get('priceOverride')?.toString().trim();
		await updateBooking(params.id, {
			...(isSessionBased ? {} : {
				instructorId: form.get('instructorId')?.toString() || null,
				time: form.get('time')?.toString() || null,
			}),
			date: form.get('date')?.toString(),
			isFlexible: form.get('isFlexible') === 'true',
			status: newStatus,
			spotNotes: form.get('spotNotes')?.toString() || null,
			notes: form.get('notes')?.toString() || null,
			priceOverride: priceOverrideRaw ? priceOverrideRaw : null
		});
		const message = newStatus === 'confirmed' ? 'Booking confirmed' : 'Booking updated';
		return { error: null, message };
	},

	updatePayment: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		const amountPaid = form.get('amountPaid')?.toString() ?? '0';
		const amountDue = parseFloat(form.get('amountDue')?.toString() ?? '0');
		const paid = parseFloat(amountPaid);
		const status = paid >= amountDue ? 'paid' : paid > 0 ? 'partial' : 'pending';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await updateBookingClientPayment(bookingClientId, amountPaid, status);
		return { error: null, message: 'Payment updated' };
	},

	enroll: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const clientId = form.get('clientId')?.toString() ?? '';
		const amountDue = form.get('amountDue')?.toString() ?? '0';
		if (!clientId) return fail(400, { error: 'Client is required' });

		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Booking not found' });

		const max = booking.serviceMaxCapacity ?? Infinity;
		if (booking.clients.length >= max) return fail(400, { error: 'Camp is full' });

		const alreadyEnrolled = booking.clients.some((c) => c.clientId === clientId);
		if (alreadyEnrolled) return fail(400, { error: 'Client already enrolled' });

		await addClientToBooking(params.id, clientId, amountDue);
		return { error: null, message: 'Student enrolled' };
	},

	unenroll: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const clientId = form.get('clientId')?.toString() ?? '';
		if (!clientId) return fail(400, { error: 'Client is required' });
		await removeClientFromBooking(params.id, clientId);
		return { error: null, message: 'Student removed' };
	},

	cancel: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		await cancelBooking(params.id);
		return { cancelled: true, message: 'Booking cancelled' };
	},

	delete: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Not found' });
		if (booking.status !== 'cancelled')
			return fail(400, { error: 'Only cancelled bookings can be deleted' });
		const hasPaid = booking.clients.some(c => parseFloat(c.amountPaid) > 0);
		if (hasPaid)
			return fail(400, { error: 'Cannot delete a booking with recorded payments' });
		await deleteBooking(params.id);
		redirect(303, '/bookings');
	},

	updateAmountDue: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		const amountDue = form.get('amountDue')?.toString() ?? '0';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await updateBookingClientAmountDue(bookingClientId, amountDue);
		return { error: null, message: 'Amount updated' };
	},

	cancelClient: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await cancelBookingClient(bookingClientId);
		return { error: null, message: 'Client enrollment cancelled' };
	},

	reenrollClient: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await reenrollBookingClient(bookingClientId);
		return { error: null, message: 'Client re-enrolled' };
	},

	addSession: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const date = form.get('sessionDate')?.toString() ?? '';
		const time = form.get('sessionTime')?.toString() || undefined;
		const durRaw = form.get('sessionDuration')?.toString();
		const durationMinutes = durRaw ? parseInt(durRaw) : undefined;
		const notes = form.get('sessionNotes')?.toString() || undefined;
		const instructorIds = form.getAll('sessionInstructorId').map(String).filter(Boolean);
		if (!date) return fail(400, { error: 'Session date required' });
		await createSession({ bookingId: params.id, date, time, durationMinutes, notes, instructorIds });
		return { error: null, message: 'Session added' };
	},

	updateSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		const time = form.get('sessionTime')?.toString() || null;
		const durRaw = form.get('sessionDuration')?.toString();
		const durationMinutes = durRaw ? parseInt(durRaw) : null;
		const notes = form.get('sessionNotes')?.toString() || null;
		const instructorIds = form.getAll('sessionInstructorId').map(String).filter(Boolean);
		const skillLevelRaw = form.get('sessionLevel')?.toString() || null;
		const skillLevel = (skillLevelRaw as 'beginner' | 'intermediate' | 'advanced' | null) ?? null;
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		await updateSession(sessionId, { time, durationMinutes, notes, instructorIds, skillLevel });
		return { error: null, message: 'Session updated' };
	},

	cancelSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		await cancelSession(sessionId);
		return { error: null, message: 'Session cancelled' };
	},

	deleteSession: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		await deleteSession(sessionId);
		return { error: null, message: 'Session deleted' };
	},

	linkToSession: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		await linkSessionToBooking(sessionId, params.id);
		return { error: null, message: 'Linked to session' };
	},

	unlinkFromSession: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		if (!sessionId) return fail(400, { error: 'Missing session id' });
		await unlinkSessionFromBooking(sessionId, params.id);
		return { error: null, message: 'Unlinked from session' };
	},

	addParticipant: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const sessionId = form.get('sessionId')?.toString() ?? '';
		const name = form.get('participantName')?.toString().trim() ?? '';
		if (!sessionId || !name) return fail(400, { error: 'Session and name are required' });
		await addParticipant({ sessionId, name });
		return { error: null, message: 'Participant added' };
	},

	removeParticipant: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const participantId = form.get('participantId')?.toString() ?? '';
		if (!participantId) return fail(400, { error: 'Missing participant id' });
		await removeParticipant(participantId);
		return { error: null, message: 'Participant removed' };
	},

	bulkGenerateSessions: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Booking not found' });
		if (!booking.dateEnd) return fail(400, { error: 'Booking has no end date' });
		if (!booking.serviceHasSessions) return fail(400, { error: 'Service does not use sessions' });

		const sessionsPerDay = Math.min(6, Math.max(1, parseInt(form.get('sessionsPerDay')?.toString() ?? '1')));
		const times = Array.from({ length: sessionsPerDay }, (_, i) =>
			form.get(`sessionTime_${i}`)?.toString() || undefined
		);
		const weekdaysOnly = form.get('weekdaysOnly') === 'on';
		const clearExisting = form.get('clearExisting') === 'on';

		if (clearExisting) await deleteSessionsForBooking(params.id);

		const start = new Date(booking.date + 'T00:00:00');
		const end = new Date(booking.dateEnd + 'T00:00:00');
		const toCreate: { bookingId: string; date: string; time?: string; sortOrder: number }[] = [];

		for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			const dow = d.getDay();
			if (weekdaysOnly && (dow === 0 || dow === 6)) continue;
			const dateStr = d.toISOString().slice(0, 10);
			for (let i = 0; i < sessionsPerDay; i++) {
				toCreate.push({ bookingId: params.id, date: dateStr, time: times[i], sortOrder: i });
			}
		}

		await Promise.all(toCreate.map(s => createSession(s)));
		return { error: null, message: `${toCreate.length} sessions generated` };
	},

	addBookingParticipant: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const addToSessions = form.get('addToSessions') === 'true';
		if (!name) return fail(400, { error: 'Name is required' });
		await addBookingParticipant(params.id, name);
		if (addToSessions) {
			const sessions = await listSessionsForBooking(params.id);
			await Promise.all(sessions.map(s => addParticipant({ sessionId: s.id, name })));
		}
		return { error: null, message: 'Participant added' };
	},

	removeBookingParticipant: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const id = form.get('participantId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Missing participant id' });
		await removeBookingParticipant(id);
		return { error: null, message: 'Participant removed' };
	},

	updateAllocStatus: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const allocId = form.get('allocId')?.toString() ?? '';
		const status = form.get('status')?.toString() as AllocationStatus;
		if (!allocId) return fail(400, { error: 'Missing allocation id' });
		await updateAllocation(allocId, { status });
		return { error: null, message: 'Status updated' };
	},

	reassignAllocItem: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const allocId = form.get('allocId')?.toString() ?? '';
		const itemId = form.get('itemId')?.toString() || null;
		if (!allocId) return fail(400, { error: 'Missing allocation id' });
		await updateAllocation(allocId, { itemId });
		return { error: null, message: 'Item reassigned' };
	},

	removeAlloc: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const allocId = form.get('allocId')?.toString() ?? '';
		if (!allocId) return fail(400, { error: 'Missing allocation id' });
		await deleteAllocation(allocId);
		return { error: null, message: 'Allocation removed' };
	},

	addAlloc: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const booking = await getBooking(params.id);
		if (!booking) return fail(404, { error: 'Booking not found' });
		const itemTypeId = form.get('itemTypeId')?.toString() ?? '';
		if (!itemTypeId) return fail(400, { error: 'Item type required' });
		const specificItemId = form.get('specificItemId')?.toString() || null;
		if (!specificItemId) return fail(400, { error: 'Select a specific item' });

		const type = await getInventoryItemType(itemTypeId);
		if (!type) return fail(400, { error: 'Item type not found' });

		const startDate = booking.date;
		const endDate = booking.dateEnd ?? null;
		const avail = await checkAvailability(itemTypeId, startDate, endDate, 1, undefined, params.id);
		const itemAvailable = avail.availableItems.some(i => i.id === specificItemId);
		if (!itemAvailable) {
			return fail(400, { error: `"${type.name}" not available` });
		}

		await createAllocation({ bookingId: params.id, itemTypeId, itemId: specificItemId, quantity: 1, startDate, endDate });
		return { error: null, message: `${type.name} added` };
	}
};
