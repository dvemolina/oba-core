# Service Runs — Reusable Service Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-service dates with a `service_runs` junction table so one "Surf Camp" service template can have multiple dated runs (July 14–21, August 4–11, etc.), each with its own capacity and roster.

**Architecture:** Add `service_runs` table. Migrate existing `services.start_date/end_date` data into runs. Add `bookings.service_run_id` FK so each booking belongs to a specific run. Capacity enforcement moves to the run level. The booking create form shows a run picker when the service has date-range runs. Service detail page gains a Runs section (add/edit/delete runs). Camp roster page (`/bookings/camp/[serviceId]`) shows all runs for a service with per-run rosters.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Drizzle ORM, PostgreSQL, Tailwind CSS v4

---

## File Map

**Create:**
- `drizzle/0025_service_runs.sql` — migration: create table, migrate data, drop old columns
- `src/lib/features/services/runs.types.ts` — `ServiceRun` type
- `src/lib/features/services/runs.queries.ts` — CRUD + capacity queries for runs
- `src/routes/(app)/bookings/camp/[id]/+page.server.ts` — camp roster by service (all runs)
- `src/routes/(app)/bookings/camp/[id]/+page.svelte` — camp roster UI

**Modify:**
- `src/lib/server/db/schema.ts` — add `serviceRuns` table def, add `serviceRunId` to `bookings`
- `src/lib/features/services/types.ts` — remove `startDate`, `endDate` from `Service`/inputs
- `src/lib/features/bookings/types.ts` — add `serviceRunId`, `serviceRunStartDate`, `serviceRunEndDate` to `Booking`/`BookingSummary`/`CreateBookingInput`
- `src/lib/features/bookings/queries.ts` — add `serviceRunId` to select, `createBooking`, add `countEnrolledClientsForRun()`
- `src/lib/features/services/queries.ts` — remove `startDate`/`endDate` from service queries
- `src/routes/(app)/services/[id]/+page.server.ts` — load runs, add `addRun`/`deleteRun` actions
- `src/routes/(app)/services/[id]/+page.svelte` — Runs section (list, add form, delete), remove startDate/endDate edit fields
- `src/routes/(app)/services/+page.svelte` — show first run date range under camp services; update camp roster link logic
- `src/routes/(app)/bookings/new/+page.server.ts` — load runs for selected service, handle `serviceRunId`
- `src/routes/(app)/bookings/new/+page.svelte` — run picker replaces hard-coded camp dates
- `src/routes/(app)/bookings/[id]/+page.svelte` — show run dates if booking has a run

---

### Task 1: Schema + types

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/features/services/types.ts`
- Modify: `src/lib/features/bookings/types.ts`

- [ ] **Step 1.1: Add `serviceRuns` table + `serviceRunId` to `bookings` in `src/lib/server/db/schema.ts`**

After the `serviceInstructors` table definition and before `bookings`, insert:

```typescript
export const serviceRuns = pgTable('service_runs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id, { onDelete: 'cascade' }),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	maxCapacity: integer('max_capacity'),
	notes: text('notes'),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => [
	index('idx_service_runs_service').on(t.serviceId),
	index('idx_service_runs_dates').on(t.startDate, t.endDate)
]);
```

In `bookings` pgTable, add after `dateEnd`:

```typescript
	serviceRunId: text('service_run_id')
		.references(() => serviceRuns.id, { onDelete: 'set null' }),
```

Also add to the `bookings` index array:
```typescript
	index('idx_bookings_service_run').on(t.serviceRunId)
```

Remove `startDate` and `endDate` from the `services` pgTable definition entirely (they will be dropped in the migration).

- [ ] **Step 1.2: Update `src/lib/features/services/types.ts`**

Remove `startDate` and `endDate` from `Service`, `CreateServiceInput`, and `UpdateServiceInput`.

- [ ] **Step 1.3: Update `src/lib/features/bookings/types.ts`**

Add to `Booking`:
```typescript
	serviceRunId: string | null;
	serviceRunStartDate: string | null;
	serviceRunEndDate: string | null;
```

Add to `BookingSummary`:
```typescript
	serviceRunId: string | null;
	serviceRunStartDate: string | null;
	serviceRunEndDate: string | null;
```

Add to `CreateBookingInput`:
```typescript
	serviceRunId?: string;
```

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/features/services/types.ts src/lib/features/bookings/types.ts
git commit -m "feat: schema — service_runs table, bookings.service_run_id FK"
```

---

### Task 2: Service run types + queries

**Files:**
- Create: `src/lib/features/services/runs.types.ts`
- Create: `src/lib/features/services/runs.queries.ts`

- [ ] **Step 2.1: Create `src/lib/features/services/runs.types.ts`**

```typescript
export interface ServiceRun {
	id: string;
	serviceId: string;
	startDate: string;
	endDate: string;
	maxCapacity: number | null;
	notes: string | null;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
	// Computed
	enrolledCount?: number;
}

export interface CreateServiceRunInput {
	startDate: string;
	endDate: string;
	maxCapacity?: number | null;
	notes?: string | null;
}

export interface UpdateServiceRunInput extends Partial<CreateServiceRunInput> {
	active?: boolean;
}
```

- [ ] **Step 2.2: Create `src/lib/features/services/runs.queries.ts`**

```typescript
import { and, count, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { serviceRuns, bookings, bookingClients } from '$lib/server/db/schema';
import type { CreateServiceRunInput, ServiceRun, UpdateServiceRunInput } from './runs.types';

export async function listRunsForService(serviceId: string): Promise<ServiceRun[]> {
	const rows = await db
		.select()
		.from(serviceRuns)
		.where(eq(serviceRuns.serviceId, serviceId))
		.orderBy(serviceRuns.startDate);

	const ids = rows.map(r => r.id);
	if (ids.length === 0) return [];

	// Attach enrolled counts
	const counts = await db
		.select({
			serviceRunId: bookings.serviceRunId,
			total: count()
		})
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(and(
			bookings.serviceRunId ? eq(bookings.serviceRunId, bookings.serviceRunId) : undefined,
			ne(bookings.status, 'cancelled'),
			eq(bookingClients.status, 'enrolled')
		))
		.groupBy(bookings.serviceRunId);

	// NOTE: the where above needs fixing — use sql`in` pattern
	const countByRun: Record<string, number> = {};
	for (const c of counts) {
		if (c.serviceRunId) countByRun[c.serviceRunId] = Number(c.total);
	}

	return rows.map(r => ({ ...r, enrolledCount: countByRun[r.id] ?? 0 }));
}

export async function getServiceRun(id: string): Promise<ServiceRun | undefined> {
	const [row] = await db.select().from(serviceRuns).where(eq(serviceRuns.id, id));
	return row;
}

export async function createServiceRun(serviceId: string, input: CreateServiceRunInput): Promise<ServiceRun> {
	const [row] = await db
		.insert(serviceRuns)
		.values({ serviceId, ...input })
		.returning();
	return { ...row, enrolledCount: 0 };
}

export async function updateServiceRun(id: string, input: UpdateServiceRunInput): Promise<ServiceRun> {
	const [row] = await db
		.update(serviceRuns)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(serviceRuns.id, id))
		.returning();
	return row;
}

export async function deleteServiceRun(id: string): Promise<void> {
	await db.delete(serviceRuns).where(eq(serviceRuns.id, id));
}

export async function countEnrolledClientsForRun(runId: string): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(bookingClients)
		.innerJoin(bookings, eq(bookingClients.bookingId, bookings.id))
		.where(and(
			eq(bookings.serviceRunId, runId),
			ne(bookings.status, 'cancelled'),
			eq(bookingClients.status, 'enrolled')
		));
	return Number(row?.total ?? 0);
}
```

Note: `listRunsForService` enrolled count uses `inArray`. Fix the counts query to use:
```typescript
	.where(and(
		inArray(bookings.serviceRunId, ids.filter(Boolean) as string[]),
		ne(bookings.status, 'cancelled'),
		eq(bookingClients.status, 'enrolled')
	))
```
Import `inArray` from `drizzle-orm` at the top.

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/features/services/runs.types.ts src/lib/features/services/runs.queries.ts
git commit -m "feat: service runs — types and queries"
```

---

### Task 3: Update bookings queries

**Files:**
- Modify: `src/lib/features/bookings/queries.ts`

- [ ] **Step 3.1: Add `serviceRunId` join to `listBookingsForDateRange`**

In the `.select({...})` block, add:
```typescript
			serviceRunId: bookings.serviceRunId,
			serviceRunStartDate: serviceRuns.startDate,
			serviceRunEndDate: serviceRuns.endDate,
```

In the FROM/JOIN chain, add:
```typescript
		.leftJoin(serviceRuns, eq(bookings.serviceRunId, serviceRuns.id))
```

Import `serviceRuns` from `'$lib/server/db/schema'`.

- [ ] **Step 3.2: Add same join to `getBooking`**

In `getBooking`, add to the `.select({...})` block:
```typescript
			serviceRunId: bookings.serviceRunId,
			serviceRunStartDate: serviceRuns.startDate,
			serviceRunEndDate: serviceRuns.endDate,
```

And add `.leftJoin(serviceRuns, eq(bookings.serviceRunId, serviceRuns.id))`.

- [ ] **Step 3.3: Update `createBooking` to accept `serviceRunId`**

In `createBooking`, add `serviceRunId` to the insert values:
```typescript
		serviceRunId: input.serviceRunId,
```

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/features/bookings/queries.ts
git commit -m "feat: bookings queries — join service_runs, accept serviceRunId on create"
```

---

### Task 4: Migration SQL

**Files:**
- Create: `drizzle/0025_service_runs.sql`

- [ ] **Step 4.1: Write the migration**

```sql
-- ============================================================
-- Migration: service_runs table — reusable service templates
-- ============================================================

-- Step 1: Create service_runs table
CREATE TABLE IF NOT EXISTS service_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_capacity INTEGER,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_runs_service ON service_runs(service_id);
CREATE INDEX IF NOT EXISTS idx_service_runs_dates ON service_runs(start_date, end_date);

-- Step 2: Migrate existing services with dates → create a run per service
INSERT INTO service_runs (service_id, start_date, end_date, max_capacity, created_at, updated_at)
SELECT id, start_date, end_date, max_capacity, created_at, updated_at
FROM services
WHERE start_date IS NOT NULL AND end_date IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Add service_run_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_run_id TEXT REFERENCES service_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service_run ON bookings(service_run_id);

-- Step 4: Link existing bookings to their run
-- Match booking to run by service + booking.date = run.start_date
UPDATE bookings b
SET service_run_id = sr.id
FROM service_runs sr
WHERE b.service_id = sr.service_id
  AND b.date = sr.start_date;

-- Step 5: Drop start_date / end_date from services (now in service_runs)
ALTER TABLE services DROP COLUMN IF EXISTS start_date;
ALTER TABLE services DROP COLUMN IF EXISTS end_date;
```

- [ ] **Step 4.2: Apply migration to local DB**

```bash
node --env-file=.env -e "
const {default: postgres} = await import('postgres');
const {default: fs} = await import('fs');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
try {
  await sql.unsafe(fs.readFileSync('drizzle/0025_service_runs.sql', 'utf-8'));
  await sql\`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0025_service_runs.sql', \${Date.now()}) ON CONFLICT (hash) DO NOTHING\`;
  console.log('Applied');
} catch(e) { console.error(e.message, e.code); } finally { await sql.end(); }
" --input-type=module
```

Expected: `Applied`

- [ ] **Step 4.3: Commit**

```bash
git add drizzle/0025_service_runs.sql
git commit -m "feat: migration 0025 — service_runs table, migrate existing camp dates"
```

---

### Task 5: Update services queries + fix type errors

**Files:**
- Modify: `src/lib/features/services/queries.ts`

- [ ] **Step 5.1: Remove startDate/endDate from queries**

In `createService` and `updateService`, the `input` type no longer has `startDate`/`endDate`. The Drizzle types now also don't have them (column was dropped in schema). No explicit change needed — just run `pnpm check` to verify.

- [ ] **Step 5.2: Run type check**

```bash
pnpm check 2>&1 | grep "Error" | grep -v WARNING | head -30
```

Fix any type errors found. Common issues:
- Any reference to `service.startDate` or `service.endDate` in routes — these are gone; use `run.startDate` instead
- `BookingSummary` missing `serviceRunId` fields — already added in Task 1

- [ ] **Step 5.3: Commit fixes**

```bash
git add -A
git commit -m "fix: type errors after removing startDate/endDate from services"
```

---

### Task 6: Service detail — Runs section

**Files:**
- Modify: `src/routes/(app)/services/[id]/+page.server.ts`
- Modify: `src/routes/(app)/services/[id]/+page.svelte`

- [ ] **Step 6.1: Update `src/routes/(app)/services/[id]/+page.server.ts`**

Add import:
```typescript
import { listRunsForService, createServiceRun, deleteServiceRun } from '$lib/features/services/runs.queries';
```

In `load`, add runs fetch:
```typescript
	const [service, instructors, unitTypes, runs] = await Promise.all([
		getService(params.id),
		listInstructors(),
		service?.hasInventoryUnits ? listUnitTypesByService(params.id) : Promise.resolve([]),
		listRunsForService(params.id)
	]);
	// ...
	return { service, instructors, unitTypes, runs, canEditServices: canEditServices(locals) };
```

Add actions:
```typescript
	addRun: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const startDate = form.get('startDate')?.toString() ?? '';
		const endDate = form.get('endDate')?.toString() ?? '';
		const maxCapacityRaw = form.get('maxCapacity')?.toString();
		const maxCapacity = maxCapacityRaw ? parseInt(maxCapacityRaw) : null;
		const notes = form.get('notes')?.toString().trim() || null;
		if (!startDate || !endDate || startDate >= endDate) {
			return fail(400, { runError: 'Valid start and end dates required (end must be after start)' });
		}
		await createServiceRun(params.id, { startDate, endDate, maxCapacity, notes });
		return { message: 'Run added' };
	},

	deleteRun: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const runId = form.get('runId')?.toString() ?? '';
		if (!runId) return fail(400, { error: 'Missing run ID' });
		await deleteServiceRun(runId);
		return { message: 'Run deleted' };
	},
```

- [ ] **Step 6.2: Update `src/routes/(app)/services/[id]/+page.svelte` — add Runs section, remove date fields**

In the `<script>` block, make sure `PageData` includes `runs`:
```typescript
let { data, form }: { data: PageData; form: ActionData } = $props();
```
(auto-typed — no change needed)

**Remove** the startDate/endDate inputs from the edit form (lines containing `name="startDate"` and `name="endDate"`).

**Replace** the static date display block:
```svelte
{#if data.service.startDate}
  ...
{/if}
```
with:
```svelte
{#if data.runs?.length}
  <div class="mb-1 flex flex-wrap gap-1.5">
    {#each data.runs as run}
      <span class="rounded-full bg-ocean/10 px-2 py-0.5 text-xs text-ocean">
        {run.startDate} → {run.endDate}
        {#if run.maxCapacity}{run.enrolledCount ?? 0}/{run.maxCapacity}{/if}
      </span>
    {/each}
  </div>
{/if}
```

**Replace** the "Open Camp Roster" button block:
```svelte
{#if data.service.hasRoster && data.service.startDate}
  <a href="/bookings/camp/{data.service.id}" ...>Open Camp Roster</a>
{/if}
```
with:
```svelte
{#if data.service.hasRoster && data.runs?.length}
  <a href="/bookings/camp/{data.service.id}" class="btn-primary btn-block text-center">
    🏕️ Open Camp Roster
  </a>
{/if}
```

**Add** a Runs section after the service info section and before the edit form section. Place it after the `<!-- Bookings -->` section or after service details:

```svelte
<!-- Runs (for date-range services) -->
{#if data.service.hasDateRange && data.canEditServices}
  <section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Runs</h2>
    <p class="mb-3 text-xs text-muted">Each run is a specific dated occurrence of this service template.</p>

    {#if form?.runError}
      <p class="mb-3 text-sm text-red-600">{form.runError}</p>
    {/if}

    {#if data.runs.length > 0}
      <div class="mb-4 space-y-2">
        {#each data.runs as run}
          <div class="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-border">
            <div>
              <p class="text-sm font-medium text-gray-800">{run.startDate} → {run.endDate}</p>
              {#if run.maxCapacity}
                <p class="text-xs text-muted">{run.enrolledCount ?? 0} / {run.maxCapacity} enrolled</p>
              {/if}
              {#if run.notes}
                <p class="text-xs text-muted">{run.notes}</p>
              {/if}
            </div>
            <div class="flex gap-2">
              <a href="/bookings/camp/{data.service.id}?run={run.id}" class="text-xs text-ocean hover:underline">Roster</a>
              {#if (run.enrolledCount ?? 0) === 0}
                <form method="POST" action="?/deleteRun" use:enhance>
                  <input type="hidden" name="runId" value={run.id} />
                  <button type="submit" class="text-xs text-red-500 hover:underline"
                    onclick={(e) => { if (!confirm('Delete this run?')) e.preventDefault(); }}>
                    Delete
                  </button>
                </form>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="mb-3 text-xs text-muted">No runs yet.</p>
    {/if}

    <form method="POST" action="?/addRun" use:enhance class="grid grid-cols-2 gap-3">
      <div class="col-span-2 grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700">Start date</label>
          <input type="date" name="startDate" required class="input w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-700">End date</label>
          <input type="date" name="endDate" required class="input w-full" />
        </div>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-700">Capacity <span class="text-muted">(optional)</span></label>
        <input type="number" name="maxCapacity" min="1" class="input w-full" placeholder="10" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-700">Notes <span class="text-muted">(optional)</span></label>
        <input type="text" name="notes" class="input w-full" placeholder="e.g. Beginner focus" />
      </div>
      <div class="col-span-2">
        <button type="submit" class="btn-primary btn-sm">Add run</button>
      </div>
    </form>
  </section>
{/if}
```

- [ ] **Step 6.3: Commit**

```bash
git add "src/routes/(app)/services/[id]/"
git commit -m "feat: service detail — runs section (list, add, delete)"
```

---

### Task 7: Services list — show runs

**Files:**
- Modify: `src/routes/(app)/services/+page.svelte`
- Modify: `src/routes/(app)/services/+page.server.ts`

- [ ] **Step 7.1: Update `src/routes/(app)/services/+page.server.ts`**

Add import and load runs for all services:
```typescript
import { listRunsForService } from '$lib/features/services/runs.queries';
```

In `load`, after fetching services, attach runs:
```typescript
	const services = await listServices();
	const runsByService: Record<string, Awaited<ReturnType<typeof listRunsForService>>> = {};
	await Promise.all(
		services
			.filter(s => s.hasDateRange)
			.map(async s => {
				runsByService[s.id] = await listRunsForService(s.id);
			})
	);
	return { services, runsByService };
```

- [ ] **Step 7.2: Update `src/routes/(app)/services/+page.svelte`**

Replace static date display:
```svelte
{#if service.startDate && service.endDate}
  <p class="text-xs text-muted">{service.startDate} → {service.endDate}</p>
{/if}
```
with:
```svelte
{#if data.runsByService[service.id]?.length}
  {#each data.runsByService[service.id] as run}
    <p class="text-xs text-muted">{run.startDate} → {run.endDate}
      {#if run.maxCapacity} · {run.enrolledCount ?? 0}/{run.maxCapacity}{/if}
    </p>
  {/each}
{/if}
```

Replace camp roster link condition:
```svelte
{#if service.hasRoster && service.startDate}
```
with:
```svelte
{#if service.hasRoster && data.runsByService[service.id]?.length}
```

Replace service card link:
```svelte
href="{service.hasRoster && service.startDate ? `/bookings/camp/${service.id}` : `/services/${service.id}`}"
```
with:
```svelte
href="{service.hasRoster && data.runsByService[service.id]?.length ? `/bookings/camp/${service.id}` : `/services/${service.id}`}"
```

- [ ] **Step 7.3: Commit**

```bash
git add "src/routes/(app)/services/"
git commit -m "feat: services list — show runs per service"
```

---

### Task 8: Booking create — run picker

**Files:**
- Modify: `src/routes/(app)/bookings/new/+page.server.ts`
- Modify: `src/routes/(app)/bookings/new/+page.svelte`

- [ ] **Step 8.1: Update `src/routes/(app)/bookings/new/+page.server.ts`**

Add imports:
```typescript
import { listRunsForService, countEnrolledClientsForRun } from '$lib/features/services/runs.queries';
import type { ServiceRun } from '$lib/features/services/runs.types';
```

In `load`, after fetching services, pre-load runs for all date-range services:
```typescript
	const runsByService: Record<string, ServiceRun[]> = {};
	await Promise.all(
		services
			.filter(s => s.hasDateRange)
			.map(async s => { runsByService[s.id] = await listRunsForService(s.id); })
	);
	return { services, instructors, clients, defaultDate, defaultTime, unitTypesByService, runsByService };
```

In the `default` action, extract `serviceRunId`:
```typescript
	const serviceRunId = form.get('serviceRunId')?.toString() || undefined;
```

For camp services (hasRoster + hasDateRange), change capacity check:
```typescript
		// For runs: check capacity per run, not per service
		if (service.hasRoster && serviceRunId) {
			const run = await getServiceRun(serviceRunId);
			if (run?.maxCapacity) {
				const enrolled = await countEnrolledClientsForRun(serviceRunId);
				const available = run.maxCapacity - enrolled;
				if (clientIds.length > available)
					return fail(400, { error: `Only ${available} slot${available !== 1 ? 's' : ''} remaining in this run` });
			}
		} else if (service.hasRoster && service.maxCapacity && !serviceRunId) {
			// Fallback: service-level capacity (for non-run roster services)
			const enrolled = await countEnrolledClientsForService(serviceId);
			const available = service.maxCapacity - enrolled;
			if (clientIds.length > available)
				return fail(400, { error: `Only ${available} slot${available !== 1 ? 's' : ''} remaining` });
		}
```

Import `getServiceRun`:
```typescript
import { listRunsForService, countEnrolledClientsForRun, getServiceRun } from '$lib/features/services/runs.queries';
```

For camp bookings, derive dates from selected run:
```typescript
		// For date-range services: derive dates from run if one is selected
		const date = service.hasDateRange && serviceRunId
			? (await getServiceRun(serviceRunId))?.startDate ?? (form.get('date')?.toString() ?? '')
			: form.get('date')?.toString() ?? service.startDate ?? '';
		const dateEnd = service.hasDateRange && serviceRunId
			? (await getServiceRun(serviceRunId))?.endDate ?? undefined
			: form.get('dateEnd')?.toString() || undefined;
```

Pass `serviceRunId` to `createBooking`:
```typescript
		const booking = await createBooking({
			serviceId, serviceRunId, date, ...
		});
```

- [ ] **Step 8.2: Update `src/routes/(app)/bookings/new/+page.svelte`**

In the `<script>` block, add:
```typescript
	const runs = $derived(selectedService ? (data.runsByService[selectedService.id] ?? []) : []);
	let selectedRunId = $state('');
	const selectedRun = $derived(runs.find(r => r.id === selectedRunId));
```

Replace the camp dates block:
```svelte
{#if selectedService?.startDate}
  <p class="...">Camp dates: {selectedService.startDate} → {selectedService.endDate}</p>
  <input type="hidden" name="date" value={selectedService.startDate} />
  <input type="hidden" name="dateEnd" value={selectedService.endDate ?? ''} />
{/if}
```

with:
```svelte
{#if isCamp && runs.length > 0}
  <div>
    <label class="mb-1 block text-sm font-medium text-gray-700">Run *</label>
    <select
      name="serviceRunId"
      bind:value={selectedRunId}
      required
      class="input w-full"
    >
      <option value="">— select a run —</option>
      {#each runs as run}
        <option value={run.id} disabled={!run.active}>
          {run.startDate} → {run.endDate}
          {#if run.maxCapacity} ({run.enrolledCount ?? 0}/{run.maxCapacity} enrolled){/if}
          {#if run.notes} · {run.notes}{/if}
        </option>
      {/each}
    </select>
  </div>
  {#if selectedRun}
    <p class="text-xs text-muted">📅 {selectedRun.startDate} → {selectedRun.endDate}</p>
  {/if}
{:else if isCamp}
  <p class="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
    This service has no runs yet. <a href="/services/{selectedService?.id}" class="underline">Add a run</a> first.
  </p>
{/if}
```

- [ ] **Step 8.3: Commit**

```bash
git add "src/routes/(app)/bookings/new/"
git commit -m "feat: booking create — run picker for date-range services"
```

---

### Task 9: Camp roster page

**Files:**
- Create: `src/routes/(app)/bookings/camp/[id]/+page.server.ts`
- Create: `src/routes/(app)/bookings/camp/[id]/+page.svelte`

- [ ] **Step 9.1: Create `src/routes/(app)/bookings/camp/[id]/+page.server.ts`**

```typescript
import { error } from '@sveltejs/kit';
import { getService } from '$lib/features/services/queries';
import { listRunsForService } from '$lib/features/services/runs.queries';
import { listBookingsForDateRange } from '$lib/features/bookings/queries';
import { requireRole } from '$lib/server/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	const service = await getService(params.id);
	if (!service) error(404, 'Service not found');

	const runs = await listRunsForService(params.id);
	const focusRunId = url.searchParams.get('run') ?? runs[0]?.id ?? null;

	// Load bookings for each run (keyed by runId)
	const bookingsByRun: Record<string, Awaited<ReturnType<typeof listBookingsForDateRange>>> = {};
	await Promise.all(
		runs.map(async run => {
			const allBookings = await listBookingsForDateRange(run.startDate, run.endDate);
			bookingsByRun[run.id] = allBookings.filter(b => b.serviceRunId === run.id || b.id === run.id);
		})
	);

	return { service, runs, focusRunId, bookingsByRun };
};
```

Note: `listBookingsForDateRange` returns all bookings in that date range regardless of service. Filter to only those with `serviceRunId === run.id`. For clean results:

```typescript
	await Promise.all(
		runs.map(async run => {
			const allBookings = await listBookingsForDateRange(run.startDate, run.endDate);
			bookingsByRun[run.id] = allBookings.filter(b => b.serviceRunId === run.id);
		})
	);
```

- [ ] **Step 9.2: Create `src/routes/(app)/bookings/camp/[id]/+page.svelte`**

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	let activeRunId = $state(data.focusRunId ?? data.runs[0]?.id ?? '');
	const activeRun = $derived(data.runs.find(r => r.id === activeRunId));
	const activeBookings = $derived(data.bookingsByRun[activeRunId] ?? []);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">← {data.service.name}</a>
		<h1 class="text-xl font-bold text-navy">Camp Roster</h1>
	</div>

	{#if data.runs.length === 0}
		<div class="rounded-lg bg-sand p-6 text-center text-sm text-muted">
			No runs yet for this service.
			<a href="/services/{data.service.id}" class="mt-2 block text-ocean hover:underline">Add a run →</a>
		</div>
	{:else}
		<!-- Run tabs -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each data.runs as run}
				<button
					onclick={() => activeRunId = run.id}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {activeRunId === run.id ? 'bg-ocean text-white' : 'bg-surface ring-1 ring-border hover:ring-ocean/50'}"
				>
					{run.startDate} → {run.endDate}
					{#if run.maxCapacity}
						<span class="ml-1 text-xs opacity-75">
							{(data.bookingsByRun[run.id] ?? []).reduce((sum, b) => sum + (b.clientCount ?? 0), 0)}/{run.maxCapacity}
						</span>
					{/if}
				</button>
			{/each}
			<a href="/services/{data.service.id}" class="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-border hover:ring-ocean/50">
				+ Add run
			</a>
		</div>

		{#if activeRun}
			<div class="mb-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-semibold text-gray-800">{activeRun.startDate} → {activeRun.endDate}</p>
						{#if activeRun.maxCapacity}
							<p class="text-xs text-muted">{activeBookings.reduce((s, b) => s + (b.clientCount ?? 0), 0)} / {activeRun.maxCapacity} spots filled</p>
						{/if}
						{#if activeRun.notes}
							<p class="text-xs text-muted">{activeRun.notes}</p>
						{/if}
					</div>
					<a href="/bookings/new?serviceId={data.service.id}&runId={activeRunId}" class="btn-primary btn-sm">
						+ Book client
					</a>
				</div>
			</div>

			<!-- Roster table -->
			{#if activeBookings.length === 0}
				<p class="py-8 text-center text-sm text-muted">No bookings for this run yet.</p>
			{:else}
				<div class="space-y-2">
					{#each activeBookings as booking}
						<a
							href="/bookings/{booking.id}"
							class="flex items-center justify-between rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
						>
							<div>
								<p class="font-medium text-gray-800">{booking.firstClientName ?? 'Unknown'}</p>
								{#if booking.clientCount && booking.clientCount > 1}
									<p class="text-xs text-muted">+{booking.clientCount - 1} more</p>
								{/if}
							</div>
							<div class="text-right">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-sand text-muted'}">
									{booking.status}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
```

- [ ] **Step 9.3: Commit**

```bash
git add "src/routes/(app)/bookings/camp/"
git commit -m "feat: camp roster page — all runs with per-run booking list"
```

---

### Task 10: Booking detail — show run info

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

- [ ] **Step 10.1: Add run dates display**

Find the section that shows booking date info. After `booking.date` display, add:

```svelte
{#if data.booking.serviceRunId}
  <p class="text-xs text-muted">
    Run: {data.booking.serviceRunStartDate} → {data.booking.serviceRunEndDate}
  </p>
{/if}
```

- [ ] **Step 10.2: Type check + fix**

```bash
pnpm check 2>&1 | grep "Error" | grep -v WARNING | head -20
```

- [ ] **Step 10.3: Final commit**

```bash
git add -A
git commit -m "feat: service runs — complete feature (schema, queries, service detail, booking create, camp roster)"
```

---
