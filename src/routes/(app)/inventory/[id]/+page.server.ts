import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole, canEditServices } from '$lib/server/permissions';
import {
	getInventoryItemTypeWithItems,
	updateInventoryItemType,
	toggleInventoryItemTypeActive,
	deleteInventoryItemType,
	createInventoryItem,
	updateInventoryItem,
	deleteInventoryItem
} from '$lib/features/inventory/queries';
import type { Actions, PageServerLoad } from './$types';
import type { PricingUnit, ItemStatus } from '$lib/features/inventory/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const itemType = await getInventoryItemTypeWithItems(params.id);
	if (!itemType) error(404, 'Item type not found');
	return { itemType, canEdit: canEditServices(locals) };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const unitPrice = form.get('unitPrice')?.toString() ?? '';
		const pricingUnit = (form.get('pricingUnit')?.toString() ?? 'per_day') as PricingUnit;
		const totalPoolSizeRaw = form.get('totalPoolSize')?.toString();
		const totalPoolSize = totalPoolSizeRaw ? parseInt(totalPoolSizeRaw) : null;
		const capacityRaw = form.get('capacity')?.toString();
		const capacity = capacityRaw ? parseInt(capacityRaw) : null;

		const attrKeys = form.getAll('attributeKey').map(String).filter(Boolean);
		const attrValues = form.getAll('attributeValues').map(String);
		const attributeSchema: Record<string, string[]> = {};
		for (let i = 0; i < attrKeys.length; i++) {
			const key = attrKeys[i].trim().toLowerCase();
			const vals = (attrValues[i] ?? '').split(',').map((v) => v.trim()).filter(Boolean);
			if (key && vals.length > 0) attributeSchema[key] = vals;
		}

		if (!name) return fail(400, { error: 'Name is required' });
		if (!unitPrice || isNaN(parseFloat(unitPrice))) return fail(400, { error: 'Valid price required' });

		await updateInventoryItemType(params.id, {
			name,
			description,
			unitPrice,
			pricingUnit,
			totalPoolSize,
			capacity,
			attributeSchema
		});
		return { message: 'Updated' };
	},

	toggle: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		await toggleInventoryItemTypeActive(params.id);
		return { message: 'Toggled' };
	},

	delete: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		await deleteInventoryItemType(params.id);
		redirect(303, '/inventory');
	},

	addItem: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { itemError: 'Name is required' });

		const itemType = await getInventoryItemTypeWithItems(params.id);
		const attributes: Record<string, string> = {};
		if (itemType) {
			for (const key of Object.keys(itemType.attributeSchema)) {
				const val = form.get(`attr_${key}`)?.toString() ?? '';
				if (val) attributes[key] = val;
			}
		}

		await createInventoryItem(params.id, { name, attributes });
		return { message: 'Item added' };
	},

	updateItemStatus: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const itemId = form.get('itemId')?.toString() ?? '';
		const status = (form.get('status')?.toString() ?? 'available') as ItemStatus;
		if (!itemId) return fail(400, { error: 'Missing item ID' });
		await updateInventoryItem(itemId, { status });
		return { message: 'Status updated' };
	},

	deleteItem: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const itemId = form.get('itemId')?.toString() ?? '';
		if (!itemId) return fail(400, { error: 'Missing item ID' });
		await deleteInventoryItem(itemId);
		return { message: 'Item deleted' };
	}
};
