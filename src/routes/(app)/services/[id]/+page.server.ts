import { error, fail, redirect } from '@sveltejs/kit';
import { deleteService, getService, updateService } from '$lib/features/services/queries';
import type { ServiceType } from '$lib/features/services/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');
	return { service };
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

		if (!name || !type || !basePrice) {
			return fail(400, { error: 'Name, type, and price are required' });
		}

		await updateService(params.id, { name, type, basePrice, description, durationMinutes });
		redirect(302, '/services');
	},

	toggle: async ({ params }) => {
		const service = await getService(params.id);
		if (!service) error(404);
		await updateService(params.id, { active: !service.active });
		return {};
	},

	delete: async ({ params }) => {
		const result = await deleteService(params.id);
		if (!result.deleted) {
			return fail(409, {
				error: 'This service is used by existing bookings or events and cannot be deleted. Deactivate it instead.'
			});
		}
		redirect(302, '/services');
	}
};
