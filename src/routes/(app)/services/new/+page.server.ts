import { fail, redirect } from '@sveltejs/kit';
import { createService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { ServiceType } from '$lib/features/services/types';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const instructors = await listInstructors();
	return { instructors };
};

export const actions: Actions = {
	default: async ({ request }) => {
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
			return fail(400, { error: 'Name, type, and price are required', values: { name, type, basePrice, description } });
		}

		if (isNaN(parseFloat(basePrice))) {
			return fail(400, { error: 'Price must be a number', values: { name, type, basePrice, description } });
		}

		if (type === 'camp' && (!campStartDate || !campEndDate || !maxStudents)) {
			return fail(400, { error: 'Camp requires start date, end date, and max students', values: { name, type, basePrice, description } });
		}

		await createService({
			name, type, basePrice, description, durationMinutes,
			campStartDate, campEndDate, maxStudents,
			campInstructorIds: campInstructorIds.length > 0 ? campInstructorIds : undefined,
			color
		});
		redirect(302, '/services');
	}
};
