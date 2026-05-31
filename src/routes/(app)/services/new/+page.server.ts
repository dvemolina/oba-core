import { fail, redirect } from '@sveltejs/kit';
import { createService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { ServiceTemplate } from '$lib/features/services/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const instructors = await listInstructors();
	return { instructors };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const type = (form.get('type')?.toString() ?? 'lesson') as ServiceTemplate;
		const basePrice = form.get('basePrice')?.toString() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const durationRaw = form.get('durationMinutes')?.toString();
		const durationMinutes = durationRaw ? parseInt(durationRaw) : undefined;
		const startDate = form.get('startDate')?.toString() || undefined;
		const endDate = form.get('endDate')?.toString() || undefined;
		const maxCapacityRaw = form.get('maxCapacity')?.toString();
		const maxCapacity = maxCapacityRaw ? parseInt(maxCapacityRaw) : undefined;
		const defaultInstructorIds = form.getAll('defaultInstructorId').map(String);
		const colorRaw = form.get('color')?.toString() ?? '';
		const color = isValidColorKey(colorRaw) ? colorRaw : DEFAULT_COLOR;

		// Capability flags from form (set by template selection or manual toggles)
		const hasSessions       = form.get('hasSessions') === 'true';
		const hasRoster         = form.get('hasRoster') === 'true';
		const hasDateRange      = form.get('hasDateRange') === 'true';
		const hasInventoryUnits = form.get('hasInventoryUnits') === 'true';
		const requiresInstructor = form.get('requiresInstructor') !== 'false'; // default true

		if (!name || !basePrice) {
			return fail(400, { error: 'Name and price are required' });
		}
		if (isNaN(parseFloat(basePrice))) {
			return fail(400, { error: 'Price must be a number' });
		}
		if (hasRoster && hasDateRange && (!startDate || !endDate || !maxCapacity)) {
			return fail(400, { error: 'Roster services with date range require start date, end date, and max capacity' });
		}

		await createService({
			name, type, basePrice, description, durationMinutes,
			hasSessions, hasRoster, hasDateRange, hasInventoryUnits, requiresInstructor,
			startDate, endDate, maxCapacity,
			defaultInstructorIds: defaultInstructorIds.length > 0 ? defaultInstructorIds : undefined,
			color
		});
		redirect(302, '/services');
	}
};
