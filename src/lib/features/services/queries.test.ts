import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { services } from '$lib/server/db/schema';
import { listServices, getService, createService, updateService, deleteService } from './queries';

// Integration tests — require DB running on localhost:5432
describe('service queries', () => {
	beforeEach(async () => {
		await db.delete(services);
	});

	it('creates and retrieves a service', async () => {
		const created = await createService({
			name: 'Group Surf Lesson',
			type: 'lesson',
			durationMinutes: 90,
			basePrice: '40.00'
		});

		expect(created.name).toBe('Group Surf Lesson');
		expect(created.active).toBe(true);

		const found = await getService(created.id);
		expect(found?.id).toBe(created.id);
	});

	it('lists only active services by default', async () => {
		await createService({ name: 'Active', type: 'lesson', basePrice: '30.00' });
		const all = await listServices(true);
		await deleteService(all[0].id); // soft-delete first one

		const active = await listServices();
		expect(active.every((s) => s.active)).toBe(true);
	});

	it('updates a service', async () => {
		const s = await createService({ name: 'Old', type: 'lesson', basePrice: '20.00' });
		const updated = await updateService(s.id, { name: 'New', basePrice: '25.00' });
		expect(updated.name).toBe('New');
		expect(updated.basePrice).toBe('25.00');
	});
});
