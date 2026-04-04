import { fail, redirect } from '@sveltejs/kit';
import { createService } from '$lib/features/services/queries';
import type { ServiceType } from '$lib/features/services/types';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const type = form.get('type')?.toString() as ServiceType;
		const basePrice = form.get('basePrice')?.toString() ?? '';
		const description = form.get('description')?.toString().trim() || undefined;
		const durationRaw = form.get('durationMinutes')?.toString();
		const durationMinutes = durationRaw ? parseInt(durationRaw) : undefined;

		if (!name || !type || !basePrice) {
			return fail(400, { error: 'Name, type, and price are required', values: { name, type, basePrice, description } });
		}

		if (isNaN(parseFloat(basePrice))) {
			return fail(400, { error: 'Price must be a number', values: { name, type, basePrice, description } });
		}

		await createService({ name, type, basePrice, description, durationMinutes });
		redirect(302, '/services');
	}
};
