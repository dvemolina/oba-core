import { requireRole } from '$lib/server/permissions';
import { listInventoryItemTypes } from '$lib/features/inventory/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const itemTypes = await listInventoryItemTypes(true);
	return { itemTypes };
};
