import { fail, redirect } from '@sveltejs/kit';
import { createService, setServiceInstructors } from '$lib/features/services/queries';
import { createServiceEdition } from '$lib/features/services/editions.queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';
import { PRICING_MODE_OPTIONS } from '$lib/utils/pricing';
import type { PricingMode } from '$lib/features/services/types';
import { requireRole } from '$lib/server/permissions';
import { listInventoryItemTypes } from '$lib/features/inventory/queries';
import { addInventoryLink } from '$lib/features/inventory/serviceLinks.queries';

const VALID_PRICING_MODES = new Set<PricingMode>(PRICING_MODE_OPTIONS.map(o => o.value));
function parsePricingMode(raw: string | null): PricingMode | null {
	return raw && VALID_PRICING_MODES.has(raw as PricingMode) ? (raw as PricingMode) : null;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const [instructors, allItemTypes] = await Promise.all([listInstructors(), listInventoryItemTypes()]);
	return { instructors, allItemTypes };
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
		const modulesRaw = form.get('modules');
		const modules    = modulesRaw ? JSON.parse(modulesRaw as string) : {};
		const pricingMode = parsePricingMode(form.get('pricingMode')?.toString() ?? null);

		// Draft editions and links from inline form
		let newEditions: { startDate: string; endDate: string; maxCapacity?: number | null; notes?: string | null }[] = [];
		let newLinks: { itemTypeId: string; quantityPerBooking?: number; isIncluded?: boolean; addonPrice?: string | null; addonPricingMode?: string | null; isOptional?: boolean }[] = [];
		try {
			const edRaw = form.get('newEditions')?.toString();
			if (edRaw) newEditions = JSON.parse(edRaw);
		} catch { /* ignore parse error */ }
		try {
			const lkRaw = form.get('newLinks')?.toString();
			if (lkRaw) newLinks = JSON.parse(lkRaw);
		} catch { /* ignore parse error */ }

		const values = { name, basePrice, description: description ?? '', color };

		if (!name || !basePrice) return fail(400, { error: 'Nombre y precio son requeridos', values });
		if (isNaN(parseFloat(basePrice))) return fail(400, { error: 'El precio debe ser un número', values });
		if ('roster' in modules && !maxCapacity) {
			return fail(400, { error: 'Especifica la capacidad máxima del grupo', values });
		}

		const newService = await createService({
			name, type, basePrice, pricingMode, description, durationMinutes, defaultSessionsIncluded,
			modules, maxCapacity, color
		});

		await Promise.all([
			defaultInstructorIds.length > 0
				? setServiceInstructors(newService.id, defaultInstructorIds)
				: Promise.resolve(),
			...newEditions.map(ed => createServiceEdition(newService.id, ed)),
			...newLinks.map(lk => addInventoryLink(newService.id, {
				itemTypeId: lk.itemTypeId,
				quantityPerBooking: lk.quantityPerBooking ?? 1,
				isIncluded: lk.isIncluded ?? true,
				addonPrice: lk.addonPrice ?? null,
				addonPricingMode: (lk.addonPricingMode as PricingMode | null) ?? null,
				isOptional: lk.isOptional ?? true
			}))
		]);

		redirect(302, `/services/${newService.id}`);
	}
};
