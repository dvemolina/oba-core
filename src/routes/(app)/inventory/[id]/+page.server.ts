import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole, canEditServices } from '$lib/server/permissions';
import { getAvailabilityTimeline } from '$lib/features/inventory/availability';
import {
	getInventoryItemTypeWithItems,
	getInventoryItemType,
	updateInventoryItemType,
	toggleInventoryItemTypeActive,
	deleteInventoryItemType,
	createInventoryItem,
	bulkCreateInventoryItems,
	updateInventoryItem,
	deleteInventoryItem
} from '$lib/features/inventory/queries';
import type { Actions, PageServerLoad } from './$types';
import type { ItemStatus } from '$lib/features/inventory/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const itemType = await getInventoryItemTypeWithItems(params.id);
	if (!itemType) error(404, 'Item type not found');
	const role = locals.user?.role ?? '';
	const today = new Date().toISOString().slice(0, 10);
	const twoWeeksLater = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
	const timeline = itemType.trackingMode === 'pool' && (itemType.totalPoolSize ?? 0) > 0
		? await getAvailabilityTimeline(params.id, today, twoWeeksLater)
		: [];
	return {
		itemType,
		canEdit: canEditServices(locals),
		canManageItems: ['admin', 'owner', 'manager'].includes(role),
		timeline
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
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

		await updateInventoryItemType(params.id, {
			name,
			description,
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

	bulkAddItems: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
		const form = await request.formData();
		const baseName = form.get('baseName')?.toString().trim() ?? '';
		const countRaw = parseInt(form.get('count')?.toString() ?? '1');
		const count = isNaN(countRaw) || countRaw < 1 ? 1 : Math.min(countRaw, 100);

		if (!baseName) return fail(400, { itemError: 'Name is required' });

		const itemType = await getInventoryItemType(params.id);
		const attributes: Record<string, string> = {};
		if (itemType) {
			for (const key of Object.keys(itemType.attributeSchema)) {
				const val = form.get(`attr_${key}`)?.toString() ?? '';
				if (val) attributes[key] = val;
			}
		}

		if (count === 1) {
			await createInventoryItem(params.id, { name: baseName, attributes });
		} else {
			await bulkCreateInventoryItems(
				params.id,
				Array.from({ length: count }, (_, i) => ({
					name: `${baseName} #${i + 1}`,
					attributes,
					sortOrder: i
				}))
			);
		}

		return { message: count === 1 ? 'Item added' : `${count} items added` };
	},

	updateItemStatus: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner', 'manager');
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
