import { error, fail } from '@sveltejs/kit';
import { deleteService, getService, updateService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { ServiceType } from '$lib/features/services/types';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [service, instructors] = await Promise.all([
		getService(params.id),
		listInstructors()
	]);
	if (!service) error(404, 'Service not found');
	return { service, instructors };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const type = form.get('type')?.toString() as ServiceType;
		const basePrice = form.get('basePrice')?.toString() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const durationRaw = form.get('durationMinutes')?.toString();
		const durationMinutes = durationRaw ? parseInt(durationRaw) : undefined;
		const campStartDate = form.get('campStartDate')?.toString() || undefined;
		const campEndDate = form.get('campEndDate')?.toString() || undefined;
		const maxStudentsRaw = form.get('maxStudents')?.toString();
		const maxStudents = maxStudentsRaw ? parseInt(maxStudentsRaw) : undefined;
		const campInstructorIds = form.getAll('campInstructorId').map(String);
		const colorRaw = form.get('color')?.toString() ?? '';
		const color = isValidColorKey(colorRaw) ? colorRaw : DEFAULT_COLOR;

		if (!name || !type || !basePrice) {
			return fail(400, { error: 'Name, type, and price are required' });
		}

		if (type === 'camp' && (!campStartDate || !campEndDate || !maxStudents)) {
			return fail(400, { error: 'Camp requires start date, end date, and max students' });
		}

		await updateService(params.id, {
			name, type, basePrice, description, durationMinutes,
			campStartDate, campEndDate, maxStudents,
			campInstructorIds: campInstructorIds.length > 0 ? campInstructorIds : undefined,
			color
		});
		return { message: 'Service updated' };
	},

	toggle: async ({ params }) => {
		const service = await getService(params.id);
		if (!service) error(404);
		await updateService(params.id, { active: !service.active });
		return { message: service.active ? 'Service deactivated' : 'Service activated' };
	},

	delete: async ({ params }) => {
		const result = await deleteService(params.id);
		if (!result.deleted) {
			const msg = result.reason === 'has_future_bookings'
				? 'This service has upcoming bookings and cannot be deleted. Cancel those bookings first, or deactivate the service instead.'
				: 'This service is linked to upcoming events and cannot be deleted.';
			return fail(409, { error: msg });
		}
		return { deleted: true, message: 'Service deleted' };
	}
};
