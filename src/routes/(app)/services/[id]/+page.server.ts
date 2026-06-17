import { error, fail } from '@sveltejs/kit';
import { deleteService, getService, setServiceInstructors, updateService } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listEditionsForService, createServiceEdition, deleteServiceEdition } from '$lib/features/services/editions.queries';
import { isValidColorKey, DEFAULT_COLOR } from '$lib/features/services/colors';
import type { Actions, PageServerLoad } from './$types';
import { requireRole, canEditServices } from '$lib/server/permissions';
import { listLinksForService, addInventoryLink, removeInventoryLink, updateInventoryLink } from '$lib/features/inventory/serviceLinks.queries';
import { listInventoryItemTypes } from '$lib/features/inventory/queries';
import { PRICING_MODE_OPTIONS } from '$lib/utils/pricing';
import type { PricingMode } from '$lib/features/services/types';

const VALID_PRICING_MODES = new Set<PricingMode>(PRICING_MODE_OPTIONS.map(o => o.value));
function parsePricingMode(raw: string | null): PricingMode | null {
	return raw && VALID_PRICING_MODES.has(raw as PricingMode) ? (raw as PricingMode) : null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const [service, instructors] = await Promise.all([getService(params.id), listInstructors()]);
	if (!service) error(404, 'Service not found');

	const [inventoryLinks, allItemTypes, runs] = await Promise.all([
		listLinksForService(params.id),
		listInventoryItemTypes(),  // always load so the form can add links when module is toggled on
		listEditionsForService(params.id)
	]);

	return { service, instructors, inventoryLinks, allItemTypes, runs, canEditServices: canEditServices(locals) };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const name        = form.get('name')?.toString().trim() ?? '';
		const type        = form.get('type')?.toString().trim() || undefined;
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

		const modulesRaw  = form.get('modules');
		const modules     = modulesRaw ? JSON.parse(modulesRaw as string) : {};
		const pricingMode = parsePricingMode(form.get('pricingMode')?.toString() ?? null);

		// New editions/links drafted in the form (to create on save)
		let newEditions: { startDate: string; endDate: string; maxCapacity?: number | null; notes?: string | null }[] = [];
		let newLinks: { itemTypeId: string; quantityPerBooking?: number; isIncluded?: boolean; addonPrice?: string | null; addonPricingMode?: string | null; isOptional?: boolean }[] = [];
		try { const r = form.get('newEditions')?.toString(); if (r) newEditions = JSON.parse(r); } catch { /* ignore */ }
		try { const r = form.get('newLinks')?.toString(); if (r) newLinks = JSON.parse(r); } catch { /* ignore */ }

		if (!name || !basePrice) return fail(400, { error: 'Nombre y precio son requeridos' });
		if (('roster' in modules) && !maxCapacity)
			return fail(400, { error: 'Especifica la capacidad máxima del grupo' });

		await updateService(params.id, {
			name, type, basePrice, pricingMode, description, durationMinutes, defaultSessionsIncluded,
			modules, maxCapacity, color
		});

		await Promise.all([
			setServiceInstructors(params.id, defaultInstructorIds),
			...newEditions.map(ed => createServiceEdition(params.id, ed)),
			...newLinks.map(lk => addInventoryLink(params.id, {
				itemTypeId: lk.itemTypeId,
				quantityPerBooking: lk.quantityPerBooking ?? 1,
				isIncluded: lk.isIncluded ?? true,
				addonPrice: lk.addonPrice ?? null,
				addonPricingMode: (lk.addonPricingMode as PricingMode | null) ?? null,
				isOptional: lk.isOptional ?? true
			}))
		]);

		return { message: 'Servicio actualizado' };
	},

	toggle: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const service = await getService(params.id);
		if (!service) error(404);
		await updateService(params.id, { active: !service.active });
		return { message: service.active ? 'Service deactivated' : 'Service activated' };
	},

	delete: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const result = await deleteService(params.id);
		if (!result.deleted) {
			const msg = result.reason === 'has_future_bookings'
				? 'This service has upcoming bookings and cannot be deleted. Cancel those bookings first, or deactivate the service instead.'
				: 'This service is linked to upcoming events and cannot be deleted.';
			return fail(409, { error: msg });
		}
		return { deleted: true, message: 'Service deleted' };
	},

	addInventoryLink: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const itemTypeId = form.get('itemTypeId')?.toString() ?? '';
		if (!itemTypeId) return fail(400, { linkError: 'Select an item type' });
		const quantityRaw = form.get('quantityPerBooking')?.toString();
		const quantityPerBooking = quantityRaw ? parseInt(quantityRaw) : 1;
		const isIncluded = form.get('isIncluded') !== 'false';
		const addonPriceRaw = form.get('addonPrice')?.toString().trim();
		const addonPrice = !isIncluded && addonPriceRaw ? addonPriceRaw : null;
		const addonPricingMode = !isIncluded ? parsePricingMode(form.get('addonPricingMode')?.toString() ?? null) : null;
		const isOptional = form.get('isOptional') !== 'false';
		await addInventoryLink(params.id, { itemTypeId, quantityPerBooking, isIncluded, addonPrice, addonPricingMode, isOptional });
		return { message: 'Inventory linked' };
	},

	updateInventoryLink: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const linkId = form.get('linkId')?.toString() ?? '';
		if (!linkId) return fail(400, { error: 'Missing link ID' });
		const isIncluded = form.get('isIncluded') !== 'false';
		const quantityRaw = form.get('quantityPerBooking')?.toString();
		const quantityPerBooking = quantityRaw ? parseInt(quantityRaw) : undefined;
		const addonPriceRaw = form.get('addonPrice')?.toString().trim();
		const addonPrice = !isIncluded && addonPriceRaw ? addonPriceRaw : null;
		const addonPricingMode = !isIncluded ? parsePricingMode(form.get('addonPricingMode')?.toString() ?? null) : null;
		const isOptional = form.get('isOptional') !== 'false';
		await updateInventoryLink(linkId, { isIncluded, addonPrice, addonPricingMode, isOptional, quantityPerBooking });
		return { message: 'Link updated' };
	},

	removeInventoryLink: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const linkId = form.get('linkId')?.toString() ?? '';
		if (!linkId) return fail(400, { error: 'Missing link ID' });
		await removeInventoryLink(linkId);
		return { message: 'Link removed' };
	},

	addRun: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate   = form.get('endDate')?.toString() ?? '';
		const maxCapacityRaw = form.get('maxCapacity')?.toString();
		const maxCapacity = maxCapacityRaw ? parseInt(maxCapacityRaw) : null;
		const notes = form.get('notes')?.toString().trim() || null;
		if (!startDate || !endDate || startDate >= endDate)
			return fail(400, { runError: 'Valid start and end dates required (end must be after start)' });
		await createServiceEdition(params.id, { startDate, endDate, maxCapacity, notes });
		return { message: 'Run added' };
	},

	deleteRun: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const runId = form.get('runId')?.toString() ?? '';
		if (!runId) return fail(400, { error: 'Missing run ID' });
		await deleteServiceEdition(runId);
		return { message: 'Run deleted' };
	}
};
