import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/permissions';
import { createInventoryItemType } from '$lib/features/inventory/queries';
import type { Actions, PageServerLoad } from './$types';
import type { TrackingMode } from '$lib/features/inventory/types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();

		const name = form.get('name')?.toString().trim() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const trackingMode = (form.get('trackingMode')?.toString() ?? 'pool') as TrackingMode;
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
		if (trackingMode === 'pool' && (!totalPoolSize || totalPoolSize < 1)) {
			return fail(400, { error: 'Pool size required for pool tracking mode' });
		}

		const created = await createInventoryItemType({
			name,
			description,
			trackingMode,
			totalPoolSize,
			attributeSchema,
			capacity
		});

		redirect(303, `/inventory/${created.id}`);
	}
};
