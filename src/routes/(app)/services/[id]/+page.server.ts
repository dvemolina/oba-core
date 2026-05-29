import { error, fail } from '@sveltejs/kit';
import { deleteService, getService, updateService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import {
	listUnitTypesByService,
	createUnitType,
	deleteUnitType,
	createUnit,
	deleteUnit
} from '$lib/features/accommodation/queries';
import type { ServiceType } from '$lib/features/services/types';
import type { OccupancyType } from '$lib/features/accommodation/types';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [service, instructors] = await Promise.all([
		getService(params.id),
		listInstructors()
	]);
	if (!service) error(404, 'Service not found');

	const unitTypes = service.type === 'accommodation'
		? await listUnitTypesByService(params.id)
		: [];

	return { service, instructors, unitTypes };
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
	},

	addUnitType: async ({ request, params }) => {
		const form = await request.formData();
		const name = form.get('utName')?.toString().trim() ?? '';
		const occupancyType = (form.get('occupancyType')?.toString() ?? 'private') as OccupancyType;
		const maxOccupancy = parseInt(form.get('maxOccupancy')?.toString() ?? '1');
		const pricePerNight = form.get('pricePerNight')?.toString() ?? '';

		if (!name || !pricePerNight || isNaN(maxOccupancy)) {
			return fail(400, { utError: 'Name, occupancy, and price required' });
		}

		await createUnitType(params.id, { name, occupancyType, maxOccupancy, pricePerNight });
		return { message: 'Unit type added' };
	},

	deleteUnitType: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('unitTypeId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Missing unit type ID' });
		await deleteUnitType(id);
		return { message: 'Unit type deleted' };
	},

	addUnit: async ({ request }) => {
		const form = await request.formData();
		const unitTypeId = form.get('unitTypeId')?.toString() ?? '';
		const name = form.get('unitName')?.toString().trim() ?? '';
		if (!unitTypeId || !name) return fail(400, { error: 'Unit type and name required' });
		await createUnit(unitTypeId, { name });
		return { message: 'Unit added' };
	},

	deleteUnit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('unitId')?.toString() ?? '';
		if (!id) return fail(400, { error: 'Missing unit ID' });
		await deleteUnit(id);
		return { message: 'Unit deleted' };
	}
};
