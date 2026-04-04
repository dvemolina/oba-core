# OBA Core — Plan 2: Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Plan 1 (Foundation) must be complete. Database is running, auth works, app shell renders.

**Goal:** Implement all feature modules — Services, Instructors, Clients, Calendar (agenda + month), Bookings (create + detail), Events, and the `/api/v1/` REST layer.

**Architecture:** Each feature has a `queries.ts` for all DB access and a `types.ts` for shared TypeScript types. SvelteKit `+page.server.ts` files orchestrate load + actions by calling feature queries. UI in `+page.svelte` is Svelte 5 runes throughout. API routes at `/api/v1/` mirror the same queries.

**Tech Stack:** Svelte 5 (runes), SvelteKit 2, TypeScript, TailwindCSS v4, Drizzle ORM, Vitest

---

## File Map

```
src/lib/features/
  services/
    queries.ts         DB access for services
    types.ts           TypeScript types
  instructors/
    queries.ts
    types.ts
  clients/
    queries.ts
    types.ts
  bookings/
    queries.ts
    types.ts
  events/
    queries.ts
    types.ts
  calendar/
    utils.ts           Date grouping logic for agenda/month views

src/routes/(app)/
  services/
    +page.server.ts    load: list services
    +page.svelte       services list UI
    new/
      +page.server.ts  actions: create
      +page.svelte     create form
    [id]/
      +page.server.ts  load: single service; actions: update, delete
      +page.svelte     edit form
  instructors/         same structure as services
  clients/             same structure as services
  calendar/
    +page.server.ts    load: bookings + events for range
    +page.svelte       agenda view (default) + month toggle
  bookings/
    new/
      +page.server.ts  actions: create booking
      +page.svelte     booking creation form
    [id]/
      +page.server.ts  load: booking detail; actions: update, cancel
      +page.svelte     booking detail + edit
  events/              same structure as services

src/routes/api/v1/
  bookings/
    +server.ts         GET list, POST create
    [id]/
      +server.ts       GET detail, PATCH update, DELETE cancel
  clients/             same structure
  instructors/         same structure
  services/            same structure
  events/              same structure

src/lib/components/
  ui/
    Badge.svelte        status/payment badge
    Chip.svelte         removable client/instructor chip
    EmptyState.svelte   empty list placeholder
    PageHeader.svelte   page title + action button
  forms/
    ClientSearch.svelte hybrid search-or-create client input
```

---

## Task 1: Services Feature — Queries & Types

**Files:**
- Create: `src/lib/features/services/types.ts`
- Create: `src/lib/features/services/queries.ts`
- Create: `src/lib/features/services/queries.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/lib/features/services/types.ts
export type ServiceType = 'lesson' | 'camp' | 'product' | 'rental';

export interface Service {
	id: string;
	name: string;
	description: string | null;
	type: ServiceType;
	durationMinutes: number | null;
	basePrice: string; // Drizzle returns numeric as string
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateServiceInput {
	name: string;
	description?: string;
	type: ServiceType;
	durationMinutes?: number;
	basePrice: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
```

- [ ] **Step 2: Create queries.ts**

```typescript
// src/lib/features/services/queries.ts
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { services } from '$lib/server/db/schema';
import type { CreateServiceInput, Service, UpdateServiceInput } from './types';

export async function listServices(includeInactive = false): Promise<Service[]> {
	const rows = await db
		.select()
		.from(services)
		.where(includeInactive ? undefined : eq(services.active, true))
		.orderBy(services.type, services.name);
	return rows as Service[];
}

export async function getService(id: string): Promise<Service | undefined> {
	const [row] = await db.select().from(services).where(eq(services.id, id));
	return row as Service | undefined;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
	const [row] = await db.insert(services).values(input).returning();
	return row as Service;
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
	const [row] = await db
		.update(services)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(services.id, id))
		.returning();
	return row as Service;
}

export async function deleteService(id: string): Promise<void> {
	await db.update(services).set({ active: false, updatedAt: new Date() }).where(eq(services.id, id));
}
```

- [ ] **Step 3: Write query tests (integration — requires running DB)**

Create `src/lib/features/services/queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { services } from '$lib/server/db/schema';
import { listServices, getService, createService, updateService, deleteService } from './queries';

// These are integration tests — they require the DB to be running.
// Run with: pnpm db:start first.
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
		const s1 = await createService({ name: 'Active', type: 'lesson', basePrice: '30.00' });
		await createService({ name: 'Inactive', type: 'lesson', basePrice: '30.00' });
		await deleteService((await listServices())[1].id);

		const active = await listServices();
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe(s1.id);
	});

	it('updates a service', async () => {
		const s = await createService({ name: 'Old', type: 'lesson', basePrice: '20.00' });
		const updated = await updateService(s.id, { name: 'New', basePrice: '25.00' });
		expect(updated.name).toBe('New');
		expect(updated.basePrice).toBe('25.00');
	});
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit --run src/lib/features/services/queries.test.ts
```

Expected: PASS — 3 tests. (DB must be running: `pnpm db:start`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/services/
git commit -m "feat: services queries and types"
```

---

## Task 2: Services UI

**Files:**
- Create: `src/routes/(app)/services/+page.server.ts`
- Create: `src/routes/(app)/services/+page.svelte`
- Create: `src/routes/(app)/services/new/+page.server.ts`
- Create: `src/routes/(app)/services/new/+page.svelte`
- Create: `src/routes/(app)/services/[id]/+page.server.ts`
- Create: `src/routes/(app)/services/[id]/+page.svelte`

- [ ] **Step 1: Create services list server**

```typescript
// src/routes/(app)/services/+page.server.ts
import { listServices } from '$lib/features/services/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const services = await listServices(true); // include inactive for management
	return { services };
};
```

- [ ] **Step 2: Create services list UI**

```svelte
<!-- src/routes/(app)/services/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '$lib/features/services/types';

	let { data }: { data: PageData } = $props();

	const typeLabels: Record<string, string> = {
		lesson: 'Lesson',
		camp: 'Camp',
		product: 'Product',
		rental: 'Rental'
	};

	const grouped = $derived(
		data.services.reduce<Record<string, Service[]>>((acc, s) => {
			(acc[s.type] ??= []).push(s);
			return acc;
		}, {})
	);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Services</h1>
		<a
			href="/services/new"
			class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90"
		>
			+ New
		</a>
	</div>

	{#each Object.entries(grouped) as [type, items]}
		<section class="mb-6">
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
				{typeLabels[type]}
			</h2>
			<div class="space-y-2">
				{#each items as service}
					<a
						href="/services/{service.id}"
						class="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
					>
						<div>
							<p class="font-medium text-gray-800 {!service.active ? 'line-through opacity-50' : ''}">
								{service.name}
							</p>
							{#if service.durationMinutes}
								<p class="text-xs text-muted">{service.durationMinutes} min</p>
							{/if}
						</div>
						<div class="text-right">
							<p class="font-semibold text-gray-800">€{service.basePrice}</p>
							{#if !service.active}
								<span class="text-xs text-muted">inactive</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/each}

	{#if data.services.length === 0}
		<p class="py-12 text-center text-sm text-muted">No services yet. Add your first one.</p>
	{/if}
</div>
```

- [ ] **Step 3: Create new service server**

```typescript
// src/routes/(app)/services/new/+page.server.ts
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
```

- [ ] **Step 4: Create new service UI**

```svelte
<!-- src/routes/(app)/services/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let selectedType = $state('lesson');
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Service</h1>
	</div>

	<form
		method="post"
		class="space-y-4"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input
				name="name"
				required
				value={form?.values?.name ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="Group Surf Lesson"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Type *</label>
			<select
				name="type"
				bind:value={selectedType}
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="lesson">Lesson</option>
				<option value="camp">Camp</option>
				<option value="product">Product</option>
				<option value="rental">Rental</option>
			</select>
		</div>

		{#if selectedType === 'lesson' || selectedType === 'camp'}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
				<input
					name="durationMinutes"
					type="number"
					min="15"
					step="15"
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
					placeholder="90"
				/>
			</div>
		{/if}

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Base price (€) *</label>
			<input
				name="basePrice"
				type="number"
				step="0.01"
				min="0"
				required
				value={form?.values?.basePrice ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="40.00"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea
				name="description"
				rows="3"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="Optional description…"
			>{form?.values?.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Service'}
		</button>
	</form>
</div>
```

- [ ] **Step 5: Create edit service server**

```typescript
// src/routes/(app)/services/[id]/+page.server.ts
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
```

- [ ] **Step 6: Create edit service UI**

```svelte
<!-- src/routes/(app)/services/[id]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">Edit Service</h1>
		<form method="post" action="?/toggle" use:enhance class="ml-auto">
			<button
				type="submit"
				class="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 {data.service.active
					? 'ring-border text-muted hover:text-gray-700'
					: 'ring-confirmed text-confirmed'}"
			>
				{data.service.active ? 'Deactivate' : 'Activate'}
			</button>
		</form>
	</div>

	<form
		method="post"
		action="?/update"
		class="space-y-4"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input
				name="name"
				required
				value={data.service.name}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Type *</label>
			<select
				name="type"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				{#each ['lesson', 'camp', 'product', 'rental'] as t}
					<option value={t} selected={data.service.type === t}>{t}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
			<input
				name="durationMinutes"
				type="number"
				min="15"
				step="15"
				value={data.service.durationMinutes ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Base price (€) *</label>
			<input
				name="basePrice"
				type="number"
				step="0.01"
				min="0"
				required
				value={data.service.basePrice}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea
				name="description"
				rows="3"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>{data.service.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Changes'}
		</button>
	</form>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/services/"
git commit -m "feat: services CRUD UI"
```

---

## Task 3: Instructors Feature

**Files:**
- Create: `src/lib/features/instructors/types.ts`
- Create: `src/lib/features/instructors/queries.ts`
- Create: `src/routes/(app)/instructors/` (list, new, [id])

- [ ] **Step 1: Create types.ts**

```typescript
// src/lib/features/instructors/types.ts
export interface Instructor {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	bio: string | null;
	active: boolean;
	userId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateInstructorInput {
	name: string;
	phone?: string;
	email?: string;
	bio?: string;
}

export interface UpdateInstructorInput extends Partial<CreateInstructorInput> {
	active?: boolean;
}
```

- [ ] **Step 2: Create queries.ts**

```typescript
// src/lib/features/instructors/queries.ts
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import type { CreateInstructorInput, Instructor, UpdateInstructorInput } from './types';

export async function listInstructors(includeInactive = false): Promise<Instructor[]> {
	const rows = await db
		.select()
		.from(instructors)
		.where(includeInactive ? undefined : eq(instructors.active, true))
		.orderBy(instructors.name);
	return rows as Instructor[];
}

export async function getInstructor(id: string): Promise<Instructor | undefined> {
	const [row] = await db.select().from(instructors).where(eq(instructors.id, id));
	return row as Instructor | undefined;
}

export async function createInstructor(input: CreateInstructorInput): Promise<Instructor> {
	const [row] = await db.insert(instructors).values(input).returning();
	return row as Instructor;
}

export async function updateInstructor(
	id: string,
	input: UpdateInstructorInput
): Promise<Instructor> {
	const [row] = await db
		.update(instructors)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(instructors.id, id))
		.returning();
	return row as Instructor;
}
```

- [ ] **Step 3: Create instructors list server**

```typescript
// src/routes/(app)/instructors/+page.server.ts
import { listInstructors } from '$lib/features/instructors/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const instructors = await listInstructors(true);
	return { instructors };
};
```

- [ ] **Step 4: Create instructors list UI**

```svelte
<!-- src/routes/(app)/instructors/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Instructors</h1>
		<a href="/instructors/new" class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90">
			+ New
		</a>
	</div>

	<div class="space-y-2">
		{#each data.instructors as instructor}
			<a
				href="/instructors/{instructor.id}"
				class="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-lg font-bold text-ocean">
					{instructor.name[0].toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<p class="font-medium text-gray-800 {!instructor.active ? 'opacity-50' : ''}">
						{instructor.name}
					</p>
					{#if instructor.phone}
						<p class="text-xs text-muted">{instructor.phone}</p>
					{/if}
				</div>
				{#if !instructor.active}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted">inactive</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if data.instructors.length === 0}
		<p class="py-12 text-center text-sm text-muted">No instructors yet.</p>
	{/if}
</div>
```

- [ ] **Step 5: Create new instructor server**

```typescript
// src/routes/(app)/instructors/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { createInstructor } from '$lib/features/instructors/queries';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const phone = form.get('phone')?.toString().trim() || undefined;
		const email = form.get('email')?.toString().trim() || undefined;
		const bio = form.get('bio')?.toString().trim() || undefined;

		if (!name) return fail(400, { error: 'Name is required' });

		await createInstructor({ name, phone, email, bio });
		redirect(302, '/instructors');
	}
};
```

- [ ] **Step 6: Create new instructor UI**

```svelte
<!-- src/routes/(app)/instructors/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/instructors" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Instructor</h1>
	</div>

	<form method="post" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input name="name" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" placeholder="Chris" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input name="phone" type="tel" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input name="email" type="email" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Bio</label>
			<textarea name="bio" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Instructor'}
		</button>
	</form>
</div>
```

- [ ] **Step 7: Create edit instructor server**

```typescript
// src/routes/(app)/instructors/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getInstructor, updateInstructor } from '$lib/features/instructors/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const instructor = await getInstructor(params.id);
	if (!instructor) error(404, 'Instructor not found');
	return { instructor };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { error: 'Name is required' });

		await updateInstructor(params.id, {
			name,
			phone: form.get('phone')?.toString().trim() || undefined,
			email: form.get('email')?.toString().trim() || undefined,
			bio: form.get('bio')?.toString().trim() || undefined
		});
		redirect(302, '/instructors');
	},

	toggle: async ({ params }) => {
		const instructor = await getInstructor(params.id);
		if (!instructor) error(404);
		await updateInstructor(params.id, { active: !instructor.active });
		return {};
	}
};
```

- [ ] **Step 8: Create edit instructor UI**

```svelte
<!-- src/routes/(app)/instructors/[id]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/instructors" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">{data.instructor.name}</h1>
		<form method="post" action="?/toggle" use:enhance class="ml-auto">
			<button type="submit" class="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 {data.instructor.active ? 'ring-border text-muted' : 'ring-confirmed text-confirmed'}">
				{data.instructor.active ? 'Deactivate' : 'Activate'}
			</button>
		</form>
	</div>

	<form method="post" action="?/update" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input name="name" required value={data.instructor.name} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input name="phone" type="tel" value={data.instructor.phone ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input name="email" type="email" value={data.instructor.email ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Bio</label>
			<textarea name="bio" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">{data.instructor.bio ?? ''}</textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Changes'}
		</button>
	</form>
</div>
```

- [ ] **Step 9: Commit**

```bash
git add "src/lib/features/instructors/" "src/routes/(app)/instructors/"
git commit -m "feat: instructors CRUD"
```

---

## Task 4: Clients Feature

**Files:**
- Create: `src/lib/features/clients/types.ts`
- Create: `src/lib/features/clients/queries.ts`
- Create: `src/routes/(app)/clients/` (list, new, [id])

- [ ] **Step 1: Create types.ts**

```typescript
// src/lib/features/clients/types.ts
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Client {
	id: string;
	firstName: string;
	lastName: string;
	phone: string | null;
	email: string | null;
	nationality: string | null;
	skillLevel: SkillLevel | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateClientInput {
	firstName: string;
	lastName: string;
	phone?: string;
	email?: string;
	nationality?: string;
	skillLevel?: SkillLevel;
	notes?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}
```

- [ ] **Step 2: Create queries.ts**

```typescript
// src/lib/features/clients/queries.ts
import { eq, ilike, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clients } from '$lib/server/db/schema';
import type { Client, CreateClientInput, SkillLevel, UpdateClientInput } from './types';

export async function listClients(search?: string): Promise<Client[]> {
	const rows = search
		? await db
				.select()
				.from(clients)
				.where(
					or(
						ilike(clients.firstName, `%${search}%`),
						ilike(clients.lastName, `%${search}%`),
						ilike(clients.phone, `%${search}%`)
					)
				)
				.orderBy(clients.lastName, clients.firstName)
		: await db.select().from(clients).orderBy(clients.lastName, clients.firstName);
	return rows as Client[];
}

export async function getClient(id: string): Promise<Client | undefined> {
	const [row] = await db.select().from(clients).where(eq(clients.id, id));
	return row as Client | undefined;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
	const [row] = await db.insert(clients).values(input).returning();
	return row as Client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
	const [row] = await db
		.update(clients)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(clients.id, id))
		.returning();
	return row as Client;
}

export async function searchOrCreateClient(
	firstName: string,
	lastName: string
): Promise<Client> {
	const [existing] = await db
		.select()
		.from(clients)
		.where(
			or(
				ilike(clients.firstName, firstName),
				ilike(clients.lastName, lastName)
			)
		)
		.limit(1);

	if (existing) return existing as Client;
	return createClient({ firstName, lastName });
}
```

- [ ] **Step 3: Create clients list server**

```typescript
// src/routes/(app)/clients/+page.server.ts
import { listClients } from '$lib/features/clients/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q') ?? undefined;
	const clients = await listClients(search);
	return { clients, search };
};
```

- [ ] **Step 4: Create clients list UI**

```svelte
<!-- src/routes/(app)/clients/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let search = $state(data.search ?? '');

	const skillColors: Record<string, string> = {
		beginner: 'bg-blue-100 text-blue-700',
		intermediate: 'bg-amber-100 text-amber-700',
		advanced: 'bg-green-100 text-green-700'
	};

	function handleSearch() {
		const params = search ? `?q=${encodeURIComponent(search)}` : '';
		goto(`/clients${params}`, { replaceState: true });
	}
</script>

<div class="p-4 md:p-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Clients</h1>
		<a href="/clients/new" class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90">
			+ New
		</a>
	</div>

	<input
		type="search"
		placeholder="Search by name or phone…"
		bind:value={search}
		oninput={handleSearch}
		class="mb-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
	/>

	<div class="space-y-2">
		{#each data.clients as client}
			<a
				href="/clients/{client.id}"
				class="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold text-navy">
					{client.firstName[0]}{client.lastName[0]}
				</div>
				<div class="min-w-0 flex-1">
					<p class="font-medium text-gray-800">{client.firstName} {client.lastName}</p>
					{#if client.phone}
						<p class="truncate text-xs text-muted">{client.phone}</p>
					{/if}
				</div>
				{#if client.skillLevel}
					<span class="rounded-full px-2 py-0.5 text-xs font-medium {skillColors[client.skillLevel]}">
						{client.skillLevel}
					</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if data.clients.length === 0}
		<p class="py-12 text-center text-sm text-muted">
			{data.search ? `No clients matching "${data.search}"` : 'No clients yet.'}
		</p>
	{/if}
</div>
```

- [ ] **Step 5: Create new client server**

```typescript
// src/routes/(app)/clients/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { createClient } from '$lib/features/clients/queries';
import type { SkillLevel } from '$lib/features/clients/types';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const firstName = form.get('firstName')?.toString().trim() ?? '';
		const lastName = form.get('lastName')?.toString().trim() ?? '';

		if (!firstName || !lastName) {
			return fail(400, { error: 'First and last name are required' });
		}

		await createClient({
			firstName,
			lastName,
			phone: form.get('phone')?.toString().trim() || undefined,
			email: form.get('email')?.toString().trim() || undefined,
			nationality: form.get('nationality')?.toString().trim() || undefined,
			skillLevel: (form.get('skillLevel')?.toString() || undefined) as SkillLevel | undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		redirect(302, '/clients');
	}
};
```

- [ ] **Step 6: Create new client UI**

```svelte
<!-- src/routes/(app)/clients/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/clients" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Client</h1>
	</div>

	<form method="post" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">First name *</label>
				<input name="firstName" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Last name *</label>
				<input name="lastName" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input name="phone" type="tel" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input name="email" type="email" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
			<input name="nationality" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" placeholder="e.g. Portuguese" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Skill level</label>
			<select name="skillLevel" class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">
				<option value="">— not set —</option>
				<option value="beginner">Beginner</option>
				<option value="intermediate">Intermediate</option>
				<option value="advanced">Advanced</option>
			</select>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
			<textarea name="notes" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Client'}
		</button>
	</form>
</div>
```

- [ ] **Step 7: Create client detail server (with booking history)**

```typescript
// src/routes/(app)/clients/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getClient, updateClient } from '$lib/features/clients/queries';
import { getBookingsForClient } from '$lib/features/bookings/queries';
import type { SkillLevel } from '$lib/features/clients/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const client = await getClient(params.id);
	if (!client) error(404, 'Client not found');
	const bookings = await getBookingsForClient(params.id);
	return { client, bookings };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const firstName = form.get('firstName')?.toString().trim() ?? '';
		const lastName = form.get('lastName')?.toString().trim() ?? '';
		if (!firstName || !lastName) return fail(400, { error: 'Name required' });

		await updateClient(params.id, {
			firstName,
			lastName,
			phone: form.get('phone')?.toString().trim() || undefined,
			email: form.get('email')?.toString().trim() || undefined,
			nationality: form.get('nationality')?.toString().trim() || undefined,
			skillLevel: (form.get('skillLevel')?.toString() || undefined) as SkillLevel | undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		return {};
	}
};
```

- [ ] **Step 8: Create client detail UI**

```svelte
<!-- src/routes/(app)/clients/[id]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/clients" class="text-muted hover:text-gray-700">←</a>
		<div>
			<h1 class="text-xl font-bold text-navy">{data.client.firstName} {data.client.lastName}</h1>
			{#if data.client.skillLevel}
				<span class="text-xs text-muted">{data.client.skillLevel}</span>
			{/if}
		</div>
		<button
			onclick={() => (editing = !editing)}
			class="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-border text-muted hover:text-gray-700"
		>
			{editing ? 'Cancel' : 'Edit'}
		</button>
	</div>

	{#if editing}
		<form method="post" action="?/update" class="mb-8 space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; editing = false; update(); }; }}>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">First name</label>
					<input name="firstName" required value={data.client.firstName} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Last name</label>
					<input name="lastName" required value={data.client.lastName} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
				</div>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
				<input name="phone" type="tel" value={data.client.phone ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
				<input name="nationality" value={data.client.nationality ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Skill level</label>
				<select name="skillLevel" class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">
					<option value="">— not set —</option>
					{#each ['beginner', 'intermediate', 'advanced'] as level}
						<option value={level} selected={data.client.skillLevel === level}>{level}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
				<textarea name="notes" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">{data.client.notes ?? ''}</textarea>
			</div>
			{#if form?.error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
			{/if}
			<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
				{loading ? 'Saving…' : 'Save Changes'}
			</button>
		</form>
	{:else}
		<!-- Contact info -->
		<div class="mb-6 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border space-y-2">
			{#if data.client.phone}<p class="text-sm">📞 {data.client.phone}</p>{/if}
			{#if data.client.email}<p class="text-sm">✉️ {data.client.email}</p>{/if}
			{#if data.client.nationality}<p class="text-sm">🌍 {data.client.nationality}</p>{/if}
			{#if data.client.notes}<p class="text-sm text-muted">{data.client.notes}</p>{/if}
		</div>
	{/if}

	<!-- Booking history -->
	<h2 class="mb-3 text-sm font-semibold text-gray-700">Bookings ({data.bookings.length})</h2>
	{#if data.bookings.length === 0}
		<p class="text-sm text-muted">No bookings yet.</p>
	{:else}
		<div class="space-y-2">
			{#each data.bookings as booking}
				<a href="/bookings/{booking.id}" class="flex items-center justify-between rounded-lg bg-surface p-3 ring-1 ring-border hover:ring-ocean/50">
					<div>
						<p class="text-sm font-medium">{booking.date} {booking.time ?? ''}</p>
						<p class="text-xs text-muted">{booking.serviceName}</p>
					</div>
					<span class="rounded-full px-2 py-0.5 text-xs {booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">
						{booking.status}
					</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 9: Commit**

```bash
git add "src/lib/features/clients/" "src/routes/(app)/clients/"
git commit -m "feat: clients CRUD with booking history"
```

---

## Task 5: Bookings Feature — Queries & Types

**Files:**
- Create: `src/lib/features/bookings/types.ts`
- Create: `src/lib/features/bookings/queries.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/lib/features/bookings/types.ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface BookingClient {
	id: string;
	bookingId: string;
	clientId: string;
	clientFirstName: string;
	clientLastName: string;
	amountDue: string;
	amountPaid: string;
	paymentStatus: PaymentStatus;
}

export interface Booking {
	id: string;
	serviceId: string;
	serviceName: string;
	instructorId: string | null;
	instructorName: string | null;
	date: string;
	time: string | null;
	isFlexible: boolean;
	status: BookingStatus;
	spotNotes: string | null;
	notes: string | null;
	clients: BookingClient[];
	createdAt: Date;
	updatedAt: Date;
}

export interface BookingSummary {
	id: string;
	serviceName: string;
	instructorName: string | null;
	date: string;
	time: string | null;
	isFlexible: boolean;
	status: BookingStatus;
	clientCount: number;
}

export interface ClientBookingSummary {
	id: string;
	date: string;
	time: string | null;
	serviceName: string;
	status: BookingStatus;
}

export interface CreateBookingInput {
	serviceId: string;
	instructorId?: string;
	date: string;
	time?: string;
	isFlexible: boolean;
	spotNotes?: string;
	notes?: string;
	clients: {
		clientId: string;
		amountDue: string;
	}[];
}

export interface UpdateBookingInput {
	instructorId?: string | null;
	date?: string;
	time?: string | null;
	isFlexible?: boolean;
	status?: BookingStatus;
	spotNotes?: string | null;
	notes?: string | null;
}
```

- [ ] **Step 2: Create queries.ts**

```typescript
// src/lib/features/bookings/queries.ts
import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { bookings, bookingClients, clients, services, instructors } from '$lib/server/db/schema';
import type {
	Booking,
	BookingSummary,
	ClientBookingSummary,
	CreateBookingInput,
	UpdateBookingInput
} from './types';

export async function listBookingsForDateRange(
	from: string,
	to: string
): Promise<BookingSummary[]> {
	const rows = await db
		.select({
			id: bookings.id,
			serviceName: services.name,
			instructorName: instructors.name,
			date: bookings.date,
			time: bookings.time,
			isFlexible: bookings.isFlexible,
			status: bookings.status
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(instructors, eq(bookings.instructorId, instructors.id))
		.where(and(gte(bookings.date, from), lte(bookings.date, to)))
		.orderBy(bookings.date, bookings.time);

	// Count clients per booking using inArray
	const ids = rows.map((r) => r.id);
	const counts: Record<string, number> = {};
	if (ids.length > 0) {
		const countRows = await db
			.select()
			.from(bookingClients)
			.where(inArray(bookingClients.bookingId, ids));
		for (const row of countRows) counts[row.bookingId] = (counts[row.bookingId] ?? 0) + 1;
	}

	return rows.map((r) => ({ ...r, clientCount: counts[r.id] ?? 0 })) as BookingSummary[];
}

export async function getBooking(id: string): Promise<Booking | undefined> {
	const [booking] = await db
		.select({
			id: bookings.id,
			serviceId: bookings.serviceId,
			serviceName: services.name,
			instructorId: bookings.instructorId,
			instructorName: instructors.name,
			date: bookings.date,
			time: bookings.time,
			isFlexible: bookings.isFlexible,
			status: bookings.status,
			spotNotes: bookings.spotNotes,
			notes: bookings.notes,
			createdAt: bookings.createdAt,
			updatedAt: bookings.updatedAt
		})
		.from(bookings)
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.leftJoin(instructors, eq(bookings.instructorId, instructors.id))
		.where(eq(bookings.id, id));

	if (!booking) return undefined;

	const bookingClientRows = await db
		.select({
			id: bookingClients.id,
			bookingId: bookingClients.bookingId,
			clientId: bookingClients.clientId,
			clientFirstName: clients.firstName,
			clientLastName: clients.lastName,
			amountDue: bookingClients.amountDue,
			amountPaid: bookingClients.amountPaid,
			paymentStatus: bookingClients.paymentStatus
		})
		.from(bookingClients)
		.leftJoin(clients, eq(bookingClients.clientId, clients.id))
		.where(eq(bookingClients.bookingId, id));

	return { ...booking, clients: bookingClientRows } as Booking;
}

export async function getBookingsForClient(clientId: string): Promise<ClientBookingSummary[]> {
	const rows = await db
		.select({
			id: bookings.id,
			date: bookings.date,
			time: bookings.time,
			serviceName: services.name,
			status: bookings.status
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.leftJoin(services, eq(bookings.serviceId, services.id))
		.where(eq(bookingClients.clientId, clientId))
		.orderBy(desc(bookings.date));
	return rows as ClientBookingSummary[];
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
	const [booking] = await db
		.insert(bookings)
		.values({
			serviceId: input.serviceId,
			instructorId: input.instructorId,
			date: input.date,
			time: input.time,
			isFlexible: input.isFlexible,
			spotNotes: input.spotNotes,
			notes: input.notes
		})
		.returning();

	if (input.clients.length > 0) {
		await db.insert(bookingClients).values(
			input.clients.map((c) => ({
				bookingId: booking.id,
				clientId: c.clientId,
				amountDue: c.amountDue,
				amountPaid: '0',
				paymentStatus: 'pending' as const
			}))
		);
	}

	return (await getBooking(booking.id))!;
}

export async function updateBooking(id: string, input: UpdateBookingInput): Promise<Booking> {
	await db
		.update(bookings)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(bookings.id, id));
	return (await getBooking(id))!;
}

export async function updateBookingClientPayment(
	bookingClientId: string,
	amountPaid: string,
	paymentStatus: 'pending' | 'partial' | 'paid'
): Promise<void> {
	await db
		.update(bookingClients)
		.set({ amountPaid, paymentStatus })
		.where(eq(bookingClients.id, bookingClientId));
}

export async function cancelBooking(id: string): Promise<void> {
	await db
		.update(bookings)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(bookings.id, id));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/bookings/
git commit -m "feat: bookings queries and types"
```

---

## Task 6: Calendar — Utilities & Agenda View

**Files:**
- Create: `src/lib/features/calendar/utils.ts`
- Create: `src/lib/features/calendar/utils.test.ts`
- Create: `src/lib/features/events/types.ts`
- Create: `src/lib/features/events/queries.ts`
- Modify: `src/routes/(app)/calendar/+page.server.ts`
- Modify: `src/routes/(app)/calendar/+page.svelte`

- [ ] **Step 1: Create events types and queries (needed by calendar)**

```typescript
// src/lib/features/events/types.ts
export interface CalendarEvent {
	id: string;
	title: string;
	description: string | null;
	startDate: string;
	endDate: string;
	serviceId: string | null;
	price: string | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateEventInput {
	title: string;
	description?: string;
	startDate: string;
	endDate: string;
	serviceId?: string;
	price?: string;
	notes?: string;
}
```

```typescript
// src/lib/features/events/queries.ts
import { and, gte, lte, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import type { CalendarEvent, CreateEventInput } from './types';

export async function listEventsForDateRange(from: string, to: string): Promise<CalendarEvent[]> {
	const rows = await db
		.select()
		.from(events)
		.where(and(lte(events.startDate, to), gte(events.endDate, from)))
		.orderBy(events.startDate);
	return rows as CalendarEvent[];
}

export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
	const [row] = await db.select().from(events).where(eq(events.id, id));
	return row as CalendarEvent | undefined;
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
	const [row] = await db.insert(events).values(input).returning();
	return row as CalendarEvent;
}

export async function updateEvent(
	id: string,
	input: Partial<CreateEventInput>
): Promise<CalendarEvent> {
	const [row] = await db
		.update(events)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(events.id, id))
		.returning();
	return row as CalendarEvent;
}

export async function deleteEvent(id: string): Promise<void> {
	await db.delete(events).where(eq(events.id, id));
}
```

- [ ] **Step 2: Write failing calendar utils test**

Create `src/lib/features/calendar/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { groupBookingsByDate, getDaysInMonth, formatDate, getDateRange } from './utils';

describe('groupBookingsByDate', () => {
	it('groups bookings by their date string', () => {
		const bookings = [
			{ id: '1', date: '2025-04-10', time: '10:00', status: 'confirmed' },
			{ id: '2', date: '2025-04-10', time: '14:00', status: 'pending' },
			{ id: '3', date: '2025-04-11', time: '09:00', status: 'confirmed' }
		] as any;

		const grouped = groupBookingsByDate(bookings);
		expect(Object.keys(grouped)).toHaveLength(2);
		expect(grouped['2025-04-10']).toHaveLength(2);
		expect(grouped['2025-04-11']).toHaveLength(1);
	});
});

describe('getDaysInMonth', () => {
	it('returns 30 days for April 2025', () => {
		expect(getDaysInMonth(2025, 4)).toBe(30);
	});

	it('returns 28 days for February 2025 (non-leap)', () => {
		expect(getDaysInMonth(2025, 2)).toBe(28);
	});

	it('returns 29 days for February 2024 (leap)', () => {
		expect(getDaysInMonth(2024, 2)).toBe(29);
	});
});

describe('formatDate', () => {
	it('formats a date to YYYY-MM-DD', () => {
		expect(formatDate(new Date(2025, 3, 10))).toBe('2025-04-10');
	});
});

describe('getDateRange', () => {
	it('returns start and end of month', () => {
		const { from, to } = getDateRange('month', 2025, 4);
		expect(from).toBe('2025-04-01');
		expect(to).toBe('2025-04-30');
	});
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
pnpm test:unit --run src/lib/features/calendar/utils.test.ts
```

Expected: FAIL — file not found.

- [ ] **Step 4: Create calendar utils**

```typescript
// src/lib/features/calendar/utils.ts
import type { BookingSummary } from '$lib/features/bookings/types';

export function groupBookingsByDate(
	bookings: BookingSummary[]
): Record<string, BookingSummary[]> {
	return bookings.reduce<Record<string, BookingSummary[]>>((acc, b) => {
		(acc[b.date] ??= []).push(b);
		return acc;
	}, {});
}

export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function getDateRange(
	view: 'month' | 'week' | 'agenda',
	year: number,
	month: number
): { from: string; to: string } {
	if (view === 'month') {
		const days = getDaysInMonth(year, month);
		const m = String(month).padStart(2, '0');
		return {
			from: `${year}-${m}-01`,
			to: `${year}-${m}-${String(days).padStart(2, '0')}`
		};
	}
	// agenda: next 60 days from today
	const today = new Date();
	const future = new Date(today);
	future.setDate(future.getDate() + 60);
	return { from: formatDate(today), to: formatDate(future) };
}

export function getTodayString(): string {
	return formatDate(new Date());
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test:unit --run src/lib/features/calendar/utils.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Update calendar page server**

Replace `src/routes/(app)/calendar/+page.server.ts`:

```typescript
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { listEventsForDateRange } from '$lib/features/events/queries';
import { getDateRange, getTodayString } from '$lib/features/calendar/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const view = (url.searchParams.get('view') ?? 'agenda') as 'agenda' | 'month';
	const today = new Date();
	const year = parseInt(url.searchParams.get('year') ?? String(today.getFullYear()));
	const month = parseInt(url.searchParams.get('month') ?? String(today.getMonth() + 1));

	const { from, to } = getDateRange(view, year, month);
	const [bookings, events] = await Promise.all([
		listBookingsForDateRange(from, to),
		listEventsForDateRange(from, to)
	]);

	return { bookings, events, view, year, month, today: getTodayString() };
};
```

- [ ] **Step 7: Build agenda + month calendar UI**

Replace `src/routes/(app)/calendar/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { groupBookingsByDate, getDaysInMonth } from '$lib/features/calendar/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupBookingsByDate(data.bookings));

	// Dates that have bookings (for month view dots)
	const datesWithBookings = $derived(new Set(Object.keys(grouped)));

	function setView(v: 'agenda' | 'month') {
		goto(`/calendar?view=${v}&year=${data.year}&month=${data.month}`);
	}

	function prevMonth() {
		let y = data.year, m = data.month - 1;
		if (m < 1) { m = 12; y--; }
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	function nextMonth() {
		let y = data.year, m = data.month + 1;
		if (m > 12) { m = 1; y++; }
		goto(`/calendar?view=${data.view}&year=${y}&month=${m}`);
	}

	const monthName = $derived(
		new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' })
	);

	// Agenda: group into past + upcoming
	const today = data.today;
	const upcomingDates = $derived(
		Object.keys(grouped)
			.filter((d) => d >= today)
			.sort()
	);
	const pastDates = $derived(
		Object.keys(grouped)
			.filter((d) => d < today)
			.sort()
			.reverse()
	);

	function statusClass(status: string) {
		if (status === 'confirmed') return 'border-confirmed bg-confirmed/5';
		if (status === 'cancelled') return 'border-flexible bg-flexible/5 opacity-50';
		return 'border-pending bg-pending/5';
	}

	function flexClass(isFlexible: boolean) {
		return isFlexible ? 'border-dashed' : 'border-solid';
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="sticky top-0 z-10 bg-sand border-b border-border px-4 py-3">
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<button onclick={prevMonth} class="p-1 text-muted hover:text-gray-700">‹</button>
				<h1 class="font-bold text-navy">{monthName} {data.year}</h1>
				<button onclick={nextMonth} class="p-1 text-muted hover:text-gray-700">›</button>
			</div>
			<!-- View toggle -->
			<div class="flex rounded-lg bg-surface ring-1 ring-border overflow-hidden">
				<button
					onclick={() => setView('agenda')}
					class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'agenda' ? 'bg-ocean text-white' : 'text-muted hover:text-gray-700'}"
				>List</button>
				<button
					onclick={() => setView('month')}
					class="px-3 py-1.5 text-xs font-medium transition-colors {data.view === 'month' ? 'bg-ocean text-white' : 'text-muted hover:text-gray-700'}"
				>Month</button>
			</div>
		</div>

		<!-- Month grid (when view=month) -->
		{#if data.view === 'month'}
			<div class="grid grid-cols-7 gap-0.5 text-center">
				{#each ['M','T','W','T','F','S','S'] as d}
					<div class="text-xs text-muted py-1">{d}</div>
				{/each}
				{#each Array.from({ length: new Date(data.year, data.month - 1, 1).getDay() === 0 ? 6 : new Date(data.year, data.month - 1, 1).getDay() - 1 }) as _}
					<div></div>
				{/each}
				{#each Array.from({ length: getDaysInMonth(data.year, data.month) }, (_, i) => i + 1) as day}
					{@const dateStr = `${data.year}-${String(data.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
					{@const isToday = dateStr === today}
					{@const hasBookings = datesWithBookings.has(dateStr)}
					<a
						href="/calendar?view=agenda&year={data.year}&month={data.month}#{dateStr}"
						class="flex flex-col items-center py-1 rounded-lg hover:bg-ocean/5 transition-colors"
					>
						<span class="text-xs w-6 h-6 flex items-center justify-center rounded-full {isToday ? 'bg-ocean text-white font-bold' : 'text-gray-700'}">{day}</span>
						{#if hasBookings}
							<span class="w-1 h-1 bg-ocean rounded-full mt-0.5"></span>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Agenda list -->
	{#if data.view === 'agenda'}
		<div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
			<!-- Events (camps / fixed blocks) -->
			{#each data.events as event}
				<a href="/events/{event.id}" class="block rounded-[var(--radius-card)] bg-confirmed/10 border border-confirmed/30 p-3">
					<div class="flex items-center gap-2">
						<span class="text-base">🏕️</span>
						<div>
							<p class="text-sm font-semibold text-gray-800">{event.title}</p>
							<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						</div>
					</div>
				</a>
			{/each}

			<!-- Upcoming bookings -->
			{#if upcomingDates.length === 0 && data.events.length === 0}
				<p class="py-12 text-center text-sm text-muted">No upcoming bookings.</p>
			{/if}
			{#each upcomingDates as date}
				<div id={date}>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
						{date === today ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
					</p>
					<div class="space-y-2">
						{#each grouped[date] as booking}
							<a
								href="/bookings/{booking.id}"
								class="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-3 border-l-4 {statusClass(booking.status)} {flexClass(booking.isFlexible)} ring-1 ring-border"
							>
								<div>
									<p class="text-sm font-medium text-gray-800">
										{booking.time ? booking.time.slice(0,5) : '—'}
										{#if booking.isFlexible}<span class="text-flexible ml-1">⚡</span>{/if}
										· {booking.serviceName}
									</p>
									<p class="text-xs text-muted">
										{booking.instructorName ?? 'No instructor'} · {booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}
									</p>
								</div>
								<span class="text-xs rounded-full px-2 py-0.5 {booking.status === 'confirmed' ? 'bg-confirmed/15 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-pending/30 text-amber-700'}">
									{booking.status}
								</span>
							</a>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Past bookings (collapsed) -->
			{#if pastDates.length > 0}
				<details class="mt-6">
					<summary class="text-xs text-muted cursor-pointer hover:text-gray-600">Past bookings ({pastDates.reduce((n, d) => n + grouped[d].length, 0)})</summary>
					<div class="mt-3 space-y-4">
						{#each pastDates as date}
							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
									{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
								</p>
								<div class="space-y-2">
									{#each grouped[date] as booking}
										<a href="/bookings/{booking.id}" class="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-3 border-l-4 {statusClass(booking.status)} {flexClass(booking.isFlexible)} ring-1 ring-border opacity-70">
											<p class="text-sm text-gray-700">{booking.time?.slice(0,5) ?? '—'} · {booking.serviceName}</p>
											<span class="text-xs text-muted">{booking.clientCount} client{booking.clientCount !== 1 ? 's' : ''}</span>
										</a>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/if}
		</div>
	{/if}
</div>

<!-- FAB: New booking -->
<a
	href="/bookings/new"
	class="fixed right-4 bottom-20 md:bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ocean text-white shadow-lg text-2xl hover:bg-ocean/90 transition-colors"
	aria-label="New booking"
>
	+
</a>
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/calendar/ src/lib/features/events/ "src/routes/(app)/calendar/"
git commit -m "feat: calendar view (agenda + month) with bookings and events"
```

---

## Task 7: Booking Create & Detail

**Files:**
- Create: `src/routes/(app)/bookings/new/+page.server.ts`
- Create: `src/routes/(app)/bookings/new/+page.svelte`
- Create: `src/routes/(app)/bookings/[id]/+page.server.ts`
- Create: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 1: Create booking new server**

```typescript
// src/routes/(app)/bookings/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { createBooking } from '$lib/features/bookings/queries';
import { listServices } from '$lib/features/services/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import { listClients } from '$lib/features/clients/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [services, instructors, clients] = await Promise.all([
		listServices(),
		listInstructors(),
		listClients()
	]);
	const defaultDate = url.searchParams.get('date') ?? '';
	return { services, instructors, clients, defaultDate };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();

		const serviceId = form.get('serviceId')?.toString() ?? '';
		const instructorId = form.get('instructorId')?.toString() || undefined;
		const date = form.get('date')?.toString() ?? '';
		const time = form.get('time')?.toString() || undefined;
		const isFlexible = form.get('isFlexible') === 'on';
		const spotNotes = form.get('spotNotes')?.toString().trim() || undefined;
		const notes = form.get('notes')?.toString().trim() || undefined;

		if (!serviceId || !date) {
			return fail(400, { error: 'Service and date are required' });
		}

		// Collect client IDs + amounts from dynamic form fields
		const clientIds = form.getAll('clientId').map(String);
		const amounts = form.getAll('amountDue').map(String);

		if (clientIds.length === 0) {
			return fail(400, { error: 'At least one client is required' });
		}

		const clients = clientIds.map((clientId, i) => ({
			clientId,
			amountDue: amounts[i] ?? '0'
		}));

		const booking = await createBooking({
			serviceId,
			instructorId,
			date,
			time,
			isFlexible,
			spotNotes,
			notes,
			clients
		});

		redirect(302, `/bookings/${booking.id}`);
	}
};
```

- [ ] **Step 2: Create booking new UI**

```svelte
<!-- src/routes/(app)/bookings/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let isFlexible = $state(false);
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let clientSearch = $state('');

	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));

	const filteredClients = $derived(
		clientSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) &&
						!selectedClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);

	function addClient(client: (typeof data.clients)[0]) {
		selectedClients = [
			...selectedClients,
			{
				clientId: client.id,
				name: `${client.firstName} ${client.lastName}`,
				amountDue: selectedService?.basePrice ?? '0'
			}
		];
		clientSearch = '';
	}

	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}
</script>

<div class="p-4 md:p-6 max-w-lg mx-auto">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Booking</h1>
	</div>

	<form
		method="post"
		class="space-y-5"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<!-- Date & Time -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Date *</label>
				<input
					name="date"
					type="date"
					required
					value={data.defaultDate}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Time</label>
				<input
					name="time"
					type="time"
					disabled={isFlexible}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none disabled:opacity-40"
				/>
			</div>
		</div>

		<!-- Flexible toggle — checkbox omitted from form when unchecked, so server checks === 'on' -->
		<label class="flex items-center gap-3 rounded-lg bg-pending/10 p-3 cursor-pointer">
			<input
				type="checkbox"
				name="isFlexible"
				bind:checked={isFlexible}
				class="h-4 w-4 accent-ocean"
			/>
			<div>
				<p class="text-sm font-medium text-gray-800">⚡ Flexible time</p>
				<p class="text-xs text-muted">Confirm based on surf conditions</p>
			</div>
		</label>

		<!-- Service -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Service *</label>
			<select
				name="serviceId"
				bind:value={selectedServiceId}
				required
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				{#each data.services as service}
					<option value={service.id}>{service.name} — €{service.basePrice}</option>
				{/each}
			</select>
		</div>

		<!-- Instructor -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Instructor</label>
			<select
				name="instructorId"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">— unassigned —</option>
				{#each data.instructors as instructor}
					<option value={instructor.id}>{instructor.name}</option>
				{/each}
			</select>
		</div>

		<!-- Clients -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Clients *</label>

			<!-- Selected chips -->
			{#if selectedClients.length > 0}
				<div class="mb-2 flex flex-wrap gap-2">
					{#each selectedClients as c, i}
						<div class="flex items-center gap-1 rounded-full bg-ocean/10 pl-3 pr-1 py-1">
							<span class="text-xs font-medium text-ocean">{c.name}</span>
							<input type="hidden" name="clientId" value={c.clientId} />
							<input type="hidden" name="amountDue" value={c.amountDue} />
							<button
								type="button"
								onclick={() => removeClient(c.clientId)}
								class="ml-1 h-4 w-4 flex items-center justify-center rounded-full text-ocean/60 hover:text-ocean text-xs"
							>✕</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Search input -->
			<div class="relative">
				<input
					type="text"
					placeholder="Search or type name to add…"
					bind:value={clientSearch}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
				{#if filteredClients.length > 0}
					<div class="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg bg-surface ring-1 ring-border shadow-lg overflow-hidden">
						{#each filteredClients.slice(0, 6) as client}
							<button
								type="button"
								onclick={() => addClient(client)}
								class="w-full px-4 py-2.5 text-left text-sm hover:bg-sand transition-colors"
							>
								{client.firstName} {client.lastName}
								{#if client.phone}<span class="text-xs text-muted ml-2">{client.phone}</span>{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Notes -->
		<details class="group">
			<summary class="cursor-pointer text-sm text-muted hover:text-gray-700">Notes & spot details ▸</summary>
			<div class="mt-3 space-y-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Spot / location notes</label>
					<input name="spotNotes" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" placeholder="e.g. Playa Norte, left peak" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Internal notes</label>
					<textarea name="notes" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
				</div>
			</div>
		</details>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading || selectedClients.length === 0}
			class="w-full rounded-lg bg-ocean py-3 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Booking'}
		</button>
	</form>
</div>
```

- [ ] **Step 3: Create booking detail server**

```typescript
// src/routes/(app)/bookings/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import {
	cancelBooking,
	getBooking,
	updateBooking,
	updateBookingClientPayment
} from '$lib/features/bookings/queries';
import { listInstructors } from '$lib/features/instructors/queries';
import type { BookingStatus } from '$lib/features/bookings/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [booking, instructors] = await Promise.all([
		getBooking(params.id),
		listInstructors()
	]);
	if (!booking) error(404, 'Booking not found');
	return { booking, instructors };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		await updateBooking(params.id, {
			instructorId: form.get('instructorId')?.toString() || null,
			date: form.get('date')?.toString(),
			time: form.get('time')?.toString() || null,
			isFlexible: form.get('isFlexible') === 'true', // hidden field, always explicitly 'true'/'false'
			status: form.get('status')?.toString() as BookingStatus,
			spotNotes: form.get('spotNotes')?.toString() || null,
			notes: form.get('notes')?.toString() || null
		});
		return {};
	},

	updatePayment: async ({ request }) => {
		const form = await request.formData();
		const bookingClientId = form.get('bookingClientId')?.toString() ?? '';
		const amountPaid = form.get('amountPaid')?.toString() ?? '0';
		const amountDue = parseFloat(form.get('amountDue')?.toString() ?? '0');
		const paid = parseFloat(amountPaid);
		const status = paid >= amountDue ? 'paid' : paid > 0 ? 'partial' : 'pending';

		if (!bookingClientId) return fail(400, { error: 'Missing booking client id' });
		await updateBookingClientPayment(bookingClientId, amountPaid, status);
		return {};
	},

	cancel: async ({ params }) => {
		await cancelBooking(params.id);
		redirect(302, '/calendar');
	}
};
```

- [ ] **Step 4: Create booking detail UI**

```svelte
<!-- src/routes/(app)/bookings/[id]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);

	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending: 'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};

	const paymentColors: Record<string, string> = {
		paid: 'bg-confirmed/15 text-green-700',
		partial: 'bg-pending/30 text-amber-700',
		pending: 'bg-gray-100 text-muted'
	};
</script>

<div class="p-4 md:p-6 max-w-lg mx-auto">
	<!-- Header -->
	<div class="mb-5 flex items-start gap-3">
		<a href="/calendar" class="mt-1 text-muted hover:text-gray-700">←</a>
		<div class="flex-1">
			<h1 class="text-xl font-bold text-navy">{data.booking.serviceName}</h1>
			<p class="text-sm text-muted">
				{data.booking.date}
				{#if data.booking.time} · {data.booking.time.slice(0, 5)}{/if}
				{#if data.booking.isFlexible} <span class="text-flexible">⚡ flexible</span>{/if}
			</p>
		</div>
		<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
			{data.booking.status}
		</span>
	</div>

	<!-- Instructor -->
	<div class="mb-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border">
		<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Instructor</p>
		<form method="post" action="?/update" use:enhance>
			<input type="hidden" name="date" value={data.booking.date} />
			<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
			<select
				name="instructorId"
				onchange="this.form.submit()"
				class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">— unassigned —</option>
				{#each data.instructors as instructor}
					<option value={instructor.id} selected={data.booking.instructorId === instructor.id}>
						{instructor.name}
					</option>
				{/each}
			</select>
		</form>
	</div>

	<!-- Clients + Payment -->
	<div class="mb-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border">
		<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
			Clients & Payment
		</p>
		<div class="space-y-3">
			{#each data.booking.clients as bc}
				<div class="space-y-2">
					<p class="text-sm font-medium text-gray-800">
						{bc.clientFirstName} {bc.clientLastName}
					</p>
					<form method="post" action="?/updatePayment" use:enhance class="flex items-center gap-2">
						<input type="hidden" name="bookingClientId" value={bc.id} />
						<input type="hidden" name="amountDue" value={bc.amountDue} />
						<div class="flex-1">
							<label class="text-xs text-muted">Paid (of €{bc.amountDue})</label>
							<input
								name="amountPaid"
								type="number"
								step="0.01"
								min="0"
								max={bc.amountDue}
								value={bc.amountPaid}
								class="mt-0.5 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
							/>
						</div>
						<div class="pt-4">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {paymentColors[bc.paymentStatus]}">
								{bc.paymentStatus}
							</span>
						</div>
						<button type="submit" class="mt-4 rounded-lg bg-ocean/10 px-3 py-2 text-xs font-medium text-ocean hover:bg-ocean/20">
							Save
						</button>
					</form>
				</div>
			{/each}
		</div>
	</div>

	<!-- Notes -->
	{#if data.booking.spotNotes || data.booking.notes}
		<div class="mb-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border text-sm space-y-1">
			{#if data.booking.spotNotes}<p class="text-muted">📍 {data.booking.spotNotes}</p>{/if}
			{#if data.booking.notes}<p class="text-muted">📝 {data.booking.notes}</p>{/if}
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex gap-3">
		{#if data.booking.status !== 'confirmed'}
			<form method="post" action="?/update" use:enhance class="flex-1">
				<input type="hidden" name="status" value="confirmed" />
				<input type="hidden" name="date" value={data.booking.date} />
				<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
				<button type="submit" class="w-full rounded-lg bg-confirmed py-2.5 text-sm font-semibold text-white hover:opacity-90">
					Confirm
				</button>
			</form>
		{/if}
		{#if data.booking.status !== 'cancelled'}
			<form method="post" action="?/cancel" use:enhance class="flex-1">
				<button
					type="submit"
					onclick="return confirm('Cancel this booking?')"
					class="w-full rounded-lg py-2.5 text-sm font-semibold ring-1 ring-flexible text-flexible hover:bg-flexible/5"
				>
					Cancel
				</button>
			</form>
		{/if}
	</div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/bookings/"
git commit -m "feat: booking create and detail with payment tracking"
```

---

## Task 8: Events CRUD

**Files:**
- Create: `src/routes/(app)/events/+page.server.ts`
- Create: `src/routes/(app)/events/+page.svelte`
- Create: `src/routes/(app)/events/new/+page.server.ts`
- Create: `src/routes/(app)/events/new/+page.svelte`
- Create: `src/routes/(app)/events/[id]/+page.server.ts`
- Create: `src/routes/(app)/events/[id]/+page.svelte`

- [ ] **Step 1: Events list server**

```typescript
// src/routes/(app)/events/+page.server.ts
import { db } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const allEvents = await db.select().from(events).orderBy(desc(events.startDate));
	return { events: allEvents };
};
```

- [ ] **Step 2: Events list UI**

```svelte
<!-- src/routes/(app)/events/+page.svelte -->
<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Events</h1>
		<a href="/events/new" class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90">+ New</a>
	</div>
	<div class="space-y-2">
		{#each data.events as event}
			<a href="/events/{event.id}" class="block rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="font-medium text-gray-800">🏕️ {event.title}</p>
						<p class="text-xs text-muted">{event.startDate} → {event.endDate}</p>
						{#if event.description}<p class="mt-1 text-sm text-gray-600">{event.description}</p>{/if}
					</div>
					{#if event.price}
						<p class="shrink-0 font-semibold text-gray-800">€{event.price}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
	{#if data.events.length === 0}
		<p class="py-12 text-center text-sm text-muted">No events yet.</p>
	{/if}
</div>
```

- [ ] **Step 3: New event server**

```typescript
// src/routes/(app)/events/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { createEvent } from '$lib/features/events/queries';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim() ?? '';
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate = form.get('endDate')?.toString() ?? '';

		if (!title || !startDate || !endDate) {
			return fail(400, { error: 'Title, start date, and end date are required' });
		}
		if (endDate < startDate) {
			return fail(400, { error: 'End date must be after start date' });
		}

		await createEvent({
			title,
			startDate,
			endDate,
			description: form.get('description')?.toString().trim() || undefined,
			price: form.get('price')?.toString() || undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		redirect(302, '/events');
	}
};
```

- [ ] **Step 4: New event UI**

```svelte
<!-- src/routes/(app)/events/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6 max-w-lg mx-auto">
	<div class="mb-6 flex items-center gap-3">
		<a href="/events" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Event</h1>
	</div>
	<form method="post" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Title *</label>
			<input name="title" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" placeholder="Summer Surf Camp" />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Start date *</label>
				<input name="startDate" type="date" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">End date *</label>
				<input name="endDate" type="date" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Price (€)</label>
			<input name="price" type="number" step="0.01" min="0" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea name="description" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
			<textarea name="notes" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Event'}
		</button>
	</form>
</div>
```

- [ ] **Step 5: Event detail server**

```typescript
// src/routes/(app)/events/[id]/+page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import { getEvent, updateEvent, deleteEvent } from '$lib/features/events/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const event = await getEvent(params.id);
	if (!event) error(404, 'Event not found');
	return { event };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim() ?? '';
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate = form.get('endDate')?.toString() ?? '';
		if (!title || !startDate || !endDate) return fail(400, { error: 'Required fields missing' });
		await updateEvent(params.id, {
			title,
			startDate,
			endDate,
			description: form.get('description')?.toString().trim() || undefined,
			price: form.get('price')?.toString() || undefined,
			notes: form.get('notes')?.toString().trim() || undefined
		});
		return {};
	},
	delete: async ({ params }) => {
		await deleteEvent(params.id);
		redirect(302, '/events');
	}
};
```

- [ ] **Step 6: Event detail UI**

```svelte
<!-- src/routes/(app)/events/[id]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6 max-w-lg mx-auto">
	<div class="mb-6 flex items-center gap-3">
		<a href="/events" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">Edit Event</h1>
		<form method="post" action="?/delete" use:enhance class="ml-auto">
			<button type="submit" onclick="return confirm('Delete this event?')" class="text-xs text-flexible hover:underline">Delete</button>
		</form>
	</div>
	<form method="post" action="?/update" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Title *</label>
			<input name="title" required value={data.event.title} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Start date *</label>
				<input name="startDate" type="date" required value={data.event.startDate} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">End date *</label>
				<input name="endDate" type="date" required value={data.event.endDate} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Price (€)</label>
			<input name="price" type="number" step="0.01" min="0" value={data.event.price ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea name="description" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">{data.event.description ?? ''}</textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Changes'}
		</button>
	</form>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add "src/lib/features/events/" "src/routes/(app)/events/"
git commit -m "feat: events CRUD"
```

---

## Task 9: API v1 Layer

**Files:**
- Create: `src/routes/api/v1/bookings/+server.ts`
- Create: `src/routes/api/v1/bookings/[id]/+server.ts`
- Create: `src/routes/api/v1/clients/+server.ts`
- Create: `src/routes/api/v1/clients/[id]/+server.ts`
- Create: `src/routes/api/v1/instructors/+server.ts`
- Create: `src/routes/api/v1/services/+server.ts`
- Create: `src/routes/api/v1/events/+server.ts`
- Create: `src/lib/server/api-helpers.ts`

- [ ] **Step 1: Create API helpers**

```typescript
// src/lib/server/api-helpers.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export function apiResponse<T>(data: T, status = 200) {
	return json({ data, error: null, meta: {} }, { status });
}

export function apiError(message: string, status = 400) {
	return json({ data: null, error: message, meta: {} }, { status });
}

export function requireAuth(event: RequestEvent) {
	if (!event.locals.user) {
		return apiError('Unauthorized', 401);
	}
	return null;
}
```

- [ ] **Step 2: Create bookings API**

```typescript
// src/routes/api/v1/bookings/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { listBookingsForDateRange, createBooking } from '$lib/features/bookings/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const from = event.url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
	const to = event.url.searchParams.get('to') ?? from;

	const bookings = await listBookingsForDateRange(from, to);
	return apiResponse(bookings);
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		const booking = await createBooking(body);
		return apiResponse(booking, 201);
	} catch {
		return apiError('Invalid request body');
	}
};
```

```typescript
// src/routes/api/v1/bookings/[id]/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { cancelBooking, getBooking, updateBooking } from '$lib/features/bookings/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const booking = await getBooking(event.params.id);
	if (!booking) return apiError('Not found', 404);
	return apiResponse(booking);
};

export const PATCH: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		const booking = await updateBooking(event.params.id, body);
		return apiResponse(booking);
	} catch {
		return apiError('Invalid request body');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	await cancelBooking(event.params.id);
	return apiResponse({ cancelled: true });
};
```

- [ ] **Step 3: Create clients API**

```typescript
// src/routes/api/v1/clients/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createClient, listClients } from '$lib/features/clients/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const search = event.url.searchParams.get('q') ?? undefined;
	return apiResponse(await listClients(search));
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		return apiResponse(await createClient(body), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
```

```typescript
// src/routes/api/v1/clients/[id]/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { getBookingsForClient } from '$lib/features/bookings/queries';
import { getClient, updateClient } from '$lib/features/clients/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	const client = await getClient(event.params.id);
	if (!client) return apiError('Not found', 404);
	const bookings = await getBookingsForClient(event.params.id);
	return apiResponse({ ...client, bookings });
};

export const PATCH: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;

	try {
		const body = await event.request.json();
		return apiResponse(await updateClient(event.params.id, body));
	} catch {
		return apiError('Invalid request body');
	}
};
```

- [ ] **Step 4: Create instructors, services, events API (same pattern)**

```typescript
// src/routes/api/v1/instructors/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createInstructor, listInstructors } from '$lib/features/instructors/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listInstructors());
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createInstructor(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
```

```typescript
// src/routes/api/v1/services/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createService, listServices } from '$lib/features/services/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listServices());
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createService(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
```

```typescript
// src/routes/api/v1/events/+server.ts
import { apiError, apiResponse, requireAuth } from '$lib/server/api-helpers';
import { createEvent, listEventsForDateRange } from '$lib/features/events/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	const from = event.url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
	const to = event.url.searchParams.get('to') ?? from;
	return apiResponse(await listEventsForDateRange(from, to));
};

export const POST: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	try {
		return apiResponse(await createEvent(await event.request.json()), 201);
	} catch {
		return apiError('Invalid request body');
	}
};
```

- [ ] **Step 5: Add health check endpoint**

```typescript
// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({ status: 'ok', timestamp: new Date().toISOString() });
};
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/ src/lib/server/api-helpers.ts
git commit -m "feat: REST API v1 layer with auth guard and health check"
```

---

## Task 10: PWA Manifest

**Files:**
- Modify: `static/` — add manifest and icons
- Modify: `src/app.html`

- [ ] **Step 1: Create web manifest**

Create `static/manifest.json`:

```json
{
	"name": "OBA — Surf School",
	"short_name": "OBA",
	"description": "Surf school booking and schedule manager",
	"start_url": "/calendar",
	"display": "standalone",
	"background_color": "#f8f6f0",
	"theme_color": "#1a1a2e",
	"orientation": "portrait-primary",
	"icons": [
		{
			"src": "/icon-192.png",
			"sizes": "192x192",
			"type": "image/png",
			"purpose": "any maskable"
		},
		{
			"src": "/icon-512.png",
			"sizes": "512x512",
			"type": "image/png",
			"purpose": "any maskable"
		}
	]
}
```

- [ ] **Step 2: Add manifest link to app.html**

Edit `src/app.html` — add inside `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1a1a2e" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- [ ] **Step 3: Create placeholder icons (1x1 PNG)**

```bash
# Create minimal placeholder icons — replace with real ones before launch
node -e "
const { createCanvas } = require('canvas');
// If canvas is not available, skip and add real icons manually
console.log('Add real icons to static/icon-192.png and static/icon-512.png');
"
```

If `canvas` is not available, create the icon files manually or use any 192x192 and 512x512 PNG. The app works without them — the manifest simply won't show icons until they are added.

- [ ] **Step 4: Commit**

```bash
git add static/manifest.json src/app.html
git commit -m "feat: PWA manifest for home screen installation"
```

---

## Task 11: Final Smoke Test

- [ ] **Step 1: Run full test suite**

```bash
pnpm test:unit -- --run
```

Expected: All tests pass.

- [ ] **Step 2: Start dev server and verify all routes**

```bash
pnpm dev
```

Verify in browser:
- `/` → redirects to `/calendar`
- `/auth/login` → shows login form
- Login with `owner1@oba.surf` / `ChangeMe123!` → redirects to `/calendar`
- `/calendar` → shows agenda view with toggle
- `/services` → shows services list (empty)
- `/services/new` → create a service, verify it appears in list
- `/instructors/new` → create an instructor
- `/clients/new` → create a client
- `/bookings/new` → create a booking linking the service + instructor + client
- `/calendar` → booking appears in agenda
- Click booking → detail page shows, instructor dropdown works, payment updates

- [ ] **Step 3: Verify API**

```bash
curl -b cookies.txt http://localhost:5173/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Auth required — should get 401 without session
curl http://localhost:5173/api/v1/bookings
# Expected: {"data":null,"error":"Unauthorized","meta":{}}
```

- [ ] **Step 4: Final commit**

```bash
git add -p   # review and stage only intentional changes
git commit -m "chore: plan 2 complete — full MVP feature set"
```

---

## MVP Complete ✓

The app now has:
- ✅ Services, Instructors, Clients CRUD
- ✅ Calendar with agenda (default) + month views
- ✅ Booking creation with multi-client + payment tracking
- ✅ Booking detail with instructor assignment and payment updates
- ✅ Events (fixed calendar blocks)
- ✅ REST API v1 layer (ready for Telegram/N8N integration)
- ✅ PWA manifest (installable on phone)
- ✅ Health check endpoint (for Docker/Swarm monitoring)
