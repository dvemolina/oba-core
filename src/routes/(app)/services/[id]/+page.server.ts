import { error, fail, redirect } from '@sveltejs/kit';
import { getService, updateService } from '$lib/features/services/queries';
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
	}
};
