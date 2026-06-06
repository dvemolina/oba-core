import { fail, redirect } from '@sveltejs/kit';
import { createService, setServiceInstructors } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';
import { PRICING_MODE_OPTIONS } from '$lib/utils/pricing';
import type { PricingMode } from '$lib/features/services/types';
import { requireRole } from '$lib/server/permissions';

const VALID_PRICING_MODES = new Set<PricingMode>(PRICING_MODE_OPTIONS.map(o => o.value));
function parsePricingMode(raw: string | null): PricingMode | null {
	return raw && VALID_PRICING_MODES.has(raw as PricingMode) ? (raw as PricingMode) : null;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const instructors = await listInstructors();
	return { instructors };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const name        = form.get('name')?.toString().trim() ?? '';
		const type        = form.get('type')?.toString() ?? 'other';
		const basePrice   = form.get('basePrice')?.toString() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const durationRaw = form.get('durationMinutes')?.toString();
		const durationMinutes = durationRaw ? parseInt(durationRaw) : undefined;
		const defaultSessionsRaw = form.get('defaultSessionsIncluded')?.toString();
		const defaultSessionsIncluded = defaultSessionsRaw ? parseInt(defaultSessionsRaw) : undefined;
		const maxCapacityRaw = form.get('maxCapacity')?.toString();
		const maxCapacity = maxCapacityRaw ? parseInt(maxCapacityRaw) : undefined;
		const defaultInstructorIds = form.getAll('defaultInstructorId').map(String);
		const colorRaw = form.get('color')?.toString() ?? '';
		const color = isValidColorKey(colorRaw) ? colorRaw : DEFAULT_COLOR;

		const hasSessions        = form.get('hasSessions') === 'true';
		const hasRoster          = form.get('hasRoster') === 'true';
		const hasDateRange       = form.get('hasDateRange') === 'true';
		const hasInventoryUnits  = form.get('hasInventoryUnits') === 'true';
		const requiresInstructor = form.get('requiresInstructor') !== 'false';
		const pricingMode        = parsePricingMode(form.get('pricingMode')?.toString() ?? null);

		const values = { name, basePrice, description: description ?? '', color };

		if (!name || !basePrice) return fail(400, { error: 'Name and price are required', values });
		if (isNaN(parseFloat(basePrice))) return fail(400, { error: 'Price must be a number', values });
		if ((hasRoster || hasInventoryUnits) && !maxCapacity) {
			return fail(400, { error: 'Specify max participants / available units', values });
		}

		const newService = await createService({
			name, type, basePrice, pricingMode, description, durationMinutes, defaultSessionsIncluded,
			hasSessions, hasRoster, hasDateRange, hasInventoryUnits, requiresInstructor, maxCapacity, color
		});
		if (defaultInstructorIds.length > 0) {
			await setServiceInstructors(newService.id, defaultInstructorIds);
		}
		redirect(302, '/services');
	}
};
