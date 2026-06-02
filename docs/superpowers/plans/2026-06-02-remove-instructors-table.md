# Remove Instructors Table — Replace with User Roles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the `instructors` table and use users with `'instructor'` in their `roles[]` array throughout the entire app — single source of truth, no sync problem, no separate profile entity.

**Architecture:** Add `phone`, `bio`, `active` to the `user` table. Change `session_instructors.instructor_id` and `booking_instructors.instructor_id` FKs to point to `user.id`. Rewrite `listInstructors()` to query users. Data migration handles orphaned instructor records by creating placeholder user accounts. The `instructorId` Drizzle property name is preserved throughout to minimise diff size — it now refers to a `user.id` rather than an `instructors.id`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Better Auth, Drizzle ORM, PostgreSQL, Tailwind CSS v4

---

## File Map

**New:**
- `drizzle/0023_remove_instructors_table.sql` — full data + schema migration

**Modified:**
- `src/lib/server/db/auth.schema.ts` — add `phone`, `bio`, `active` to `user` table
- `src/lib/server/db/schema.ts` — update `sessionInstructors`/`bookingInstructors` FK to `user`, remove `instructors` table definition
- `src/lib/features/instructors/queries.ts` — rewrite to query `user` table
- `src/lib/features/instructors/types.ts` — update `Instructor` to map user fields
- `src/lib/features/sessions/queries.ts` — update `attachInstructors` join + fix raw SQL column names
- `src/lib/features/bookings/queries.ts` — update `attachInstructorsToBookings` join
- `src/routes/(app)/calendar/+page.server.ts` — resolve instructorId directly from `user.id`
- `src/routes/(app)/agenda/+page.server.ts` — same
- `src/routes/(app)/staff/+page.server.ts` — remove instructor profile logic
- `src/routes/(app)/staff/[id]/+page.server.ts` — remove `linkProfile` action, add phone/bio/active editing
- `src/routes/(app)/staff/[id]/+page.svelte` — remove link section, add phone/bio/active fields
- `src/routes/(app)/staff/new/+page.server.ts` — remove profile-linking logic
- `src/routes/(app)/staff/new/+page.svelte` — remove profile selector
- `src/routes/(app)/staff/+page.svelte` — remove instructorProfile display
- `src/routes/api/v1/instructors/+server.ts` — rewrite GET to return users with instructor role, remove POST
- `src/routes/api/v1/sessions/upcoming/+server.ts` — update join from instructors → user

---

### Task 1: Migration SQL + auth schema + domain schema

**Files:**
- Create: `drizzle/0023_remove_instructors_table.sql`
- Modify: `src/lib/server/db/auth.schema.ts`
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1.1: Create migration file `drizzle/0023_remove_instructors_table.sql`**

```sql
-- ============================================================
-- Migration: remove instructors table, users are instructors
-- ============================================================

-- Step 1: Add profile columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

-- Step 2: Copy profile data from instructors → users (linked records)
UPDATE "user" u
SET
  phone  = COALESCE(i.phone, u.phone),
  bio    = COALESCE(i.bio, u.bio),
  active = i.active
FROM instructors i
WHERE i.user_id = u.id;

-- Step 3: Create user records for orphaned instructors (no user_id)
-- Reuse the instructor's id as the user id — preserves all FK values in junction tables
INSERT INTO "user" (id, name, email, "email_verified", "created_at", "updated_at", role, roles, active, phone, bio)
SELECT
  i.id,
  i.name,
  CASE
    WHEN i.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "user" u2 WHERE u2.email = i.email)
    THEN i.email
    ELSE 'pending_' || i.id || '@setup.oba'
  END,
  false,
  i.created_at,
  i.updated_at,
  'instructor',
  ARRAY['instructor']::text[],
  i.active,
  i.phone,
  i.bio
FROM instructors i
WHERE i.user_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 4: In session_instructors, update instructor_id → user_id value
-- For linked instructors: point to their user account
UPDATE session_instructors si
SET instructor_id = i.user_id
FROM instructors i
WHERE si.instructor_id = i.id AND i.user_id IS NOT NULL;
-- (orphaned instructors already have instructor.id == new user.id — no update needed)

-- Step 5: Drop FK, rename column, add new FK in session_instructors
ALTER TABLE session_instructors DROP CONSTRAINT IF EXISTS session_instructors_instructor_id_fkey;
ALTER TABLE session_instructors RENAME COLUMN instructor_id TO user_id;
ALTER TABLE session_instructors ADD CONSTRAINT session_instructors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Step 6: Same for booking_instructors
UPDATE booking_instructors bi
SET instructor_id = i.user_id
FROM instructors i
WHERE bi.instructor_id = i.id AND i.user_id IS NOT NULL;

ALTER TABLE booking_instructors DROP CONSTRAINT IF EXISTS booking_instructors_instructor_id_fkey;
ALTER TABLE booking_instructors RENAME COLUMN instructor_id TO user_id;
ALTER TABLE booking_instructors ADD CONSTRAINT booking_instructors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Step 7: Migrate services.default_instructor_ids
-- Replace each instructor.id → user.id (or instructor.id itself if orphaned, which equals new user.id)
UPDATE services s
SET default_instructor_ids = (
  SELECT jsonb_agg(COALESCE(i.user_id, i.id))
  FROM jsonb_array_elements_text(s.default_instructor_ids::jsonb) AS elem(iid)
  JOIN instructors i ON i.id = elem.iid
)
WHERE default_instructor_ids IS NOT NULL
  AND jsonb_typeof(default_instructor_ids::jsonb) = 'array'
  AND jsonb_array_length(default_instructor_ids::jsonb) > 0;

-- Step 8: Drop the instructors table
DROP TABLE IF EXISTS instructors;
```

- [ ] **Step 1.2: Add `phone`, `bio`, `active` to `user` table in `src/lib/server/db/auth.schema.ts`**

Read the file. The `user` pgTable currently ends with `banExpires: timestamp('ban_expires')`. Add three more columns immediately after:

```typescript
  role: text('role'),
  roles: text('roles').array(),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  phone: text('phone'),
  bio: text('bio'),
  active: boolean('active').notNull().default(true)
```

- [ ] **Step 1.3: Update `src/lib/server/db/schema.ts`**

Read the file. Make three changes:

**a) Remove the entire `instructors` pgTable block** (lines 24–37):
```typescript
// DELETE this entire block:
export const instructors = pgTable('instructors', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  bio: text('bio'),
  active: boolean('active').notNull().default(true),
  userId: text('user_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});
```

**b) Update `sessionInstructors` — change `instructorId` column to reference `user` table. Add import for `user` from auth.schema:**

The file already has `export * from './auth.schema'` at the bottom, which re-exports `user`. Add a direct import at the top for use in references:

```typescript
import { user } from './auth.schema';
```

Add this import near the top of the file (after the drizzle-orm imports).

Then update `sessionInstructors`:
```typescript
export const sessionInstructors = pgTable('session_instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	instructorId: text('user_id')          // DB column renamed to user_id
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })  // FK now → user
});
```

**c) Update `bookingInstructors` the same way:**
```typescript
export const bookingInstructors = pgTable('booking_instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	bookingId: text('booking_id')
		.notNull()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	instructorId: text('user_id')          // DB column renamed to user_id
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })  // FK now → user
});
```

- [ ] **Step 1.4: Commit**

```bash
git add drizzle/0023_remove_instructors_table.sql src/lib/server/db/auth.schema.ts src/lib/server/db/schema.ts
git commit -m "feat: migration + schema — instructors table removed, user gains phone/bio/active"
```

---

### Task 2: Rewrite instructors feature module

**Files:**
- Modify: `src/lib/features/instructors/queries.ts`
- Modify: `src/lib/features/instructors/types.ts`

- [ ] **Step 2.1: Rewrite `src/lib/features/instructors/types.ts`**

Full replacement:

```typescript
export interface Instructor {
	id: string;      // user.id
	name: string;
	phone: string | null;
	email: string;   // from user.email (never null)
	bio: string | null;
	active: boolean;
	roles: string[];
}
```

- [ ] **Step 2.2: Rewrite `src/lib/features/instructors/queries.ts`**

Full replacement:

```typescript
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import type { Instructor } from './types';

function toInstructor(u: typeof userTable.$inferSelect): Instructor {
	return {
		id: u.id,
		name: u.name,
		phone: u.phone ?? null,
		email: u.email,
		bio: u.bio ?? null,
		active: u.active ?? true,
		roles: u.roles ?? []
	};
}

export async function listInstructors(includeInactive = false): Promise<Instructor[]> {
	const rows = await db
		.select()
		.from(userTable)
		.where(
			includeInactive
				? sql`'instructor' = ANY(${userTable.roles})`
				: and(
						sql`'instructor' = ANY(${userTable.roles})`,
						eq(userTable.active, true)
					)
		)
		.orderBy(userTable.name);
	return rows.map(toInstructor);
}

export async function getInstructor(id: string): Promise<Instructor | undefined> {
	const [row] = await db.select().from(userTable).where(eq(userTable.id, id));
	if (!row) return undefined;
	return toInstructor(row);
}

export async function updateInstructorProfile(
	id: string,
	input: { phone?: string | null; bio?: string | null; active?: boolean }
): Promise<Instructor> {
	const [row] = await db
		.update(userTable)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(userTable.id, id))
		.returning();
	return toInstructor(row);
}
```

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/features/instructors/
git commit -m "feat: rewrite instructors feature module — query users with instructor role"
```

---

### Task 3: Update session queries

**Files:**
- Modify: `src/lib/features/sessions/queries.ts`

- [ ] **Step 3.1: Remove `instructors` from the import block**

In the import at the top of `src/lib/features/sessions/queries.ts`, remove `instructors` from the destructured import from `'$lib/server/db/schema'`. Add an import for `user` from auth schema:

```typescript
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sessions,
	bookingSessions,
	sessionInstructors,
	sessionParticipants,
	bookings,
	bookingClients,
	clients,
	services
} from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
```

- [ ] **Step 3.2: Rewrite `attachInstructors` helper**

Replace the entire `attachInstructors` function (currently joins `instructors` table) with a version that joins `user`:

```typescript
async function attachInstructors<T extends { id: string }>(
	sessionRows: T[]
): Promise<(T & { instructors: SessionInstructor[] })[]> {
	if (sessionRows.length === 0) return sessionRows.map(s => ({ ...s, instructors: [] }));

	const ids = sessionRows.map(s => s.id);
	const rows = await db
		.select({
			id: sessionInstructors.id,
			sessionId: sessionInstructors.sessionId,
			instructorId: sessionInstructors.instructorId,
			instructorName: userTable.name
		})
		.from(sessionInstructors)
		.leftJoin(userTable, eq(sessionInstructors.instructorId, userTable.id))
		.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);

	const bySession: Record<string, typeof rows> = {};
	for (const row of rows) {
		(bySession[row.sessionId] ??= []).push(row);
	}

	return sessionRows.map(s => ({
		...s,
		instructors: (bySession[s.id] ?? []).map(r => ({
			id: r.id,
			sessionId: r.sessionId,
			instructorId: r.instructorId,
			instructorName: r.instructorName
		}))
	}));
}
```

- [ ] **Step 3.3: Fix raw SQL subqueries in `listSessionsForDate`**

Find the `instructorId` filter inside `listSessionsForDate`. The current raw SQL uses wrong quoted column names. Replace:

```typescript
sql`${sessions.id} IN (SELECT "sessionId" FROM "sessionInstructors" WHERE "instructorId" = ${instructorId})`
```

With correct snake_case DB column names (and the new `user_id` column):

```typescript
sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`
```

- [ ] **Step 3.4: Fix raw SQL subquery in `listSessionsForDateRange`**

Same fix — find the identical pattern inside `listSessionsForDateRange` and apply:

```typescript
sql`${sessions.id} IN (SELECT session_id FROM session_instructors WHERE user_id = ${instructorId})`
```

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/features/sessions/queries.ts
git commit -m "feat: session queries — join user table for instructors, fix raw SQL column names"
```

---

### Task 4: Update booking queries

**Files:**
- Modify: `src/lib/features/bookings/queries.ts`

- [ ] **Step 4.1: Remove `instructors` from imports, add `user`**

In the import from `'$lib/server/db/schema'`, remove `instructors`. Add:

```typescript
import { user as userTable } from '$lib/server/db/auth.schema';
```

- [ ] **Step 4.2: Rewrite `attachInstructorsToBookings`**

Replace the join against `instructors` with a join against `userTable`:

```typescript
async function attachInstructorsToBookings<T extends { id: string }>(
	rows: T[]
): Promise<(T & { instructorId: string | null; instructorName: string | null })[]> {
	if (rows.length === 0) return rows.map(r => ({ ...r, instructorId: null, instructorName: null }));

	const ids = rows.map(r => r.id);
	const instrRows = await db
		.select({
			bookingId: bookingInstructors.bookingId,
			instructorId: bookingInstructors.instructorId,
			instructorName: userTable.name
		})
		.from(bookingInstructors)
		.leftJoin(userTable, eq(bookingInstructors.instructorId, userTable.id))
		.where(inArray(bookingInstructors.bookingId, ids));

	const byBooking: Record<string, { instructorId: string; instructorName: string | null }> = {};
	for (const r of instrRows) {
		if (!byBooking[r.bookingId]) {
			byBooking[r.bookingId] = { instructorId: r.instructorId, instructorName: r.instructorName };
		}
	}

	return rows.map(r => ({
		...r,
		instructorId: byBooking[r.id]?.instructorId ?? null,
		instructorName: byBooking[r.id]?.instructorName ?? null
	}));
}
```

- [ ] **Step 4.3: Fix `getBooking` instructor join**

Find the inline join in `getBooking` (~line 224). Replace:

```typescript
const [instrRow] = await db
	.select({ instructorId: bookingInstructors.instructorId, instructorName: instructors.name })
	.from(bookingInstructors)
	.leftJoin(instructors, eq(bookingInstructors.instructorId, instructors.id))
	.where(eq(bookingInstructors.bookingId, id))
	.limit(1);
```

With:

```typescript
const [instrRow] = await db
	.select({ instructorId: bookingInstructors.instructorId, instructorName: userTable.name })
	.from(bookingInstructors)
	.leftJoin(userTable, eq(bookingInstructors.instructorId, userTable.id))
	.where(eq(bookingInstructors.bookingId, id))
	.limit(1);
```

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/features/bookings/queries.ts
git commit -m "feat: booking queries — join user table for instructors"
```

---

### Task 5: Calendar and agenda servers

**Files:**
- Modify: `src/routes/(app)/calendar/+page.server.ts`
- Modify: `src/routes/(app)/agenda/+page.server.ts`

- [ ] **Step 5.1: Update `src/routes/(app)/calendar/+page.server.ts`**

Read the file. Find the instructor resolution block:

```typescript
let instructorId: string | undefined;
if (isInstructorRole(locals)) {
	const [profile] = await db
		.select({ id: instructors.id })
		.from(instructors)
		.where(eq(instructors.userId, locals.user!.id));
	instructorId = profile?.id;
}
```

Replace with direct user ID — no DB lookup needed since the user IS the instructor now:

```typescript
let instructorId: string | undefined;
if (isInstructorRole(locals)) {
	instructorId = locals.user!.id;
}
```

Remove `instructors` from the import of `'$lib/server/db/schema'` (it's no longer imported here). Verify `db` and `eq` are also no longer needed for this block (they may still be used elsewhere in the file — if not, remove those imports too).

- [ ] **Step 5.2: Update `src/routes/(app)/agenda/+page.server.ts`**

Same change — find:

```typescript
let instructorId: string | undefined;
if (isInstructorRole(locals)) {
	const [profile] = await db
		.select({ id: instructors.id })
		.from(instructors)
		.where(eq(instructors.userId, locals.user!.id));
	instructorId = profile?.id;
}
```

Replace with:

```typescript
let instructorId: string | undefined;
if (isInstructorRole(locals)) {
	instructorId = locals.user!.id;
}
```

Remove `instructors` from imports if that was the only usage.

- [ ] **Step 5.3: Commit**

```bash
git add "src/routes/(app)/calendar/+page.server.ts" "src/routes/(app)/agenda/+page.server.ts"
git commit -m "feat: calendar/agenda — resolve instructorId from user.id directly"
```

---

### Task 6: Staff pages — remove instructor profile linking

**Files:**
- Modify: `src/routes/(app)/staff/+page.server.ts`
- Modify: `src/routes/(app)/staff/+page.svelte`
- Modify: `src/routes/(app)/staff/[id]/+page.server.ts`
- Modify: `src/routes/(app)/staff/[id]/+page.svelte`
- Modify: `src/routes/(app)/staff/new/+page.server.ts`
- Modify: `src/routes/(app)/staff/new/+page.svelte`

- [ ] **Step 6.1: Rewrite `src/routes/(app)/staff/+page.server.ts`**

Remove instructor profile join. Full replacement:

```typescript
import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	const staff = await db.select().from(userTable).orderBy(userTable.name);
	return { staff };
};
```

- [ ] **Step 6.2: Update `src/routes/(app)/staff/+page.svelte`**

Read the file. Remove the `instructorProfile` display block:

```svelte
{#if member.instructorProfile}
	<p class="text-xs text-muted">↳ Instructor profile: {member.instructorProfile.name}</p>
{/if}
```

Change the role badges loop to use `member.roles` directly (no fallback to `member.instructorProfile`). The existing roles display already handles this correctly — just remove the instructorProfile block.

- [ ] **Step 6.3: Rewrite `src/routes/(app)/staff/[id]/+page.server.ts`**

Remove `linkProfile` action and all instructor table queries. Add phone/bio/active editing. Full replacement:

```typescript
import { error, fail } from '@sveltejs/kit';
import { requireRole, hasRole, primaryRole } from '$lib/server/permissions';
import type { Role } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner');
	const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
	if (!member) error(404, 'Staff member not found');
	return { member, isAdmin: hasRole(locals, 'admin') };
};

export const actions: Actions = {
	updateRole: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const isAdmin = hasRole(locals, 'admin');
		const form = await request.formData();
		const allowedRoles = isAdmin
			? ['admin', 'owner', 'manager', 'instructor']
			: ['owner', 'manager', 'instructor'];
		const selectedRoles = form.getAll('roles')
			.map(r => r.toString())
			.filter(r => allowedRoles.includes(r)) as Role[];
		if (selectedRoles.length === 0) return fail(400, { error: 'At least one role is required' });
		const primary = primaryRole(selectedRoles);
		await db.update(userTable)
			.set({ roles: selectedRoles, role: primary })
			.where(eq(userTable.id, params.id));
		return { success: true };
	},

	updateProfile: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const phone = form.get('phone')?.toString().trim() || null;
		const bio = form.get('bio')?.toString().trim() || null;
		const active = form.get('active') === 'true';
		await db.update(userTable)
			.set({ phone, bio, active, updatedAt: new Date() })
			.where(eq(userTable.id, params.id));
		return { success: true };
	},

	toggleBan: async ({ params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		if (params.id === locals.user?.id) return fail(400, { error: "Can't ban yourself" });
		const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
		if (!member) error(404);
		await db.update(userTable).set({ banned: !member.banned }).where(eq(userTable.id, params.id));
		return {};
	}
};
```

- [ ] **Step 6.4: Rewrite `src/routes/(app)/staff/[id]/+page.svelte`**

Full replacement — remove instructor profile section, add profile (phone/bio/active) section:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ALL_ROLES = ['admin', 'owner', 'manager', 'instructor'] as const;
	const ROLE_LABELS: Record<string, string> = {
		admin: 'Admin', owner: 'Owner', manager: 'Manager', instructor: 'Instructor'
	};
	const ROLE_DESC: Record<string, string> = {
		admin: 'Full system access',
		owner: 'Full school access',
		manager: 'Operations — no pricing/financials',
		instructor: 'Own sessions only'
	};

	const currentRoles = $derived(
		(data.member.roles?.length ? data.member.roles : data.member.role ? [data.member.role] : []) as string[]
	);
	const visibleRoles = $derived(
		data.isAdmin ? ALL_ROLES : ALL_ROLES.filter(r => r !== 'admin')
	);
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/staff" class="text-sm text-muted hover:text-navy">← Staff</a>
		<h1 class="text-xl font-bold text-navy">{data.member.name}</h1>
	</div>

	{#if form?.error}
		<p class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.error}</p>
	{/if}

	<!-- Account info -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>
		<p class="text-sm text-gray-700">{data.member.email}</p>
		{#if data.member.banned}
			<p class="mt-1 text-xs font-medium text-red-600">Account is banned</p>
		{/if}
	</section>

	<!-- Roles -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Roles</h2>
		<p class="mb-3 text-xs text-muted">Multiple roles allowed. Permissions = union of all assigned roles.</p>
		<form method="POST" action="?/updateRole" use:enhance class="space-y-2">
			{#each visibleRoles as r}
				<label class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-border hover:bg-sand">
					<input
						type="checkbox"
						name="roles"
						value={r}
						checked={currentRoles.includes(r)}
						class="h-4 w-4 rounded border-gray-300 text-ocean"
					/>
					<span class="flex-1">
						<span class="text-sm font-medium text-gray-800">{ROLE_LABELS[r]}</span>
						<span class="ml-2 text-xs text-muted">{ROLE_DESC[r]}</span>
					</span>
				</label>
			{/each}
			<div class="pt-2">
				<button type="submit" class="btn-primary btn-sm">Save roles</button>
			</div>
		</form>
	</section>

	<!-- Profile (phone/bio/active) -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Profile</h2>
		<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
			<div>
				<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
				<input id="phone" name="phone" type="tel" value={data.member.phone ?? ''} class="input w-full" placeholder="+34 600 000 000" />
			</div>
			<div>
				<label for="bio" class="mb-1 block text-sm font-medium text-gray-700">Bio</label>
				<textarea id="bio" name="bio" rows="3" class="input w-full resize-none">{data.member.bio ?? ''}</textarea>
			</div>
			<div class="flex items-center gap-3">
				<label class="flex cursor-pointer items-center gap-2">
					<input type="hidden" name="active" value="false" />
					<input
						type="checkbox"
						name="active"
						value="true"
						checked={data.member.active ?? true}
						class="h-4 w-4 rounded border-gray-300 text-ocean"
					/>
					<span class="text-sm font-medium text-gray-700">Active (appears in session assignment)</span>
				</label>
			</div>
			<button type="submit" class="btn-primary btn-sm">Save profile</button>
		</form>
	</section>

	<!-- Access -->
	<section class="rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Access</h2>
		<form method="POST" action="?/toggleBan" use:enhance>
			<button
				type="submit"
				class="{data.member.banned ? 'btn-primary' : 'btn-danger'} btn-sm"
				onclick={(e) => { if (!confirm(data.member.banned ? 'Restore access?' : 'Ban this user?')) e.preventDefault(); }}
			>
				{data.member.banned ? 'Restore access' : 'Ban user'}
			</button>
		</form>
	</section>
</div>
```

- [ ] **Step 6.5: Rewrite `src/routes/(app)/staff/new/+page.server.ts`**

Remove all instructor profile linking. Full replacement:

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { requireRole, primaryRole } from '$lib/server/permissions';
import type { Role } from '$lib/server/permissions';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { sendStaffInvite, generateTempPassword } from '$lib/server/email/sender';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim() ?? '';
		const phone = form.get('phone')?.toString().trim() || null;
		const selectedRoles = form.getAll('roles')
			.map(r => r.toString())
			.filter(r => ['admin', 'owner', 'manager', 'instructor'].includes(r)) as Role[];

		if (!name) return fail(400, { error: 'Name is required' });
		if (!email) return fail(400, { error: 'Email is required' });
		if (selectedRoles.length === 0) return fail(400, { error: 'At least one role is required' });

		const tempPassword = generateTempPassword();

		let newUserId: string;
		try {
			const result = await auth.api.signUpEmail({
				body: { name, email, password: tempPassword }
			});
			if (!result?.user) return fail(400, { error: 'Failed to create account (email may already exist)' });
			newUserId = result.user.id;
		} catch {
			return fail(400, { error: 'Failed to create account (email may already exist)' });
		}

		const primary = primaryRole(selectedRoles);
		await db.update(userTable)
			.set({ roles: selectedRoles, role: primary, phone })
			.where(eq(userTable.id, newUserId));

		await sendStaffInvite({ to: email, name, role: primary ?? selectedRoles[0], tempPassword });

		redirect(302, '/staff');
	}
};
```

- [ ] **Step 6.6: Rewrite `src/routes/(app)/staff/new/+page.svelte`**

Remove instructor profile selector. Full replacement:

```svelte
<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/staff" class="text-sm text-muted hover:text-navy">← Staff</a>
		<h1 class="text-xl font-bold text-navy">Invite staff member</h1>
	</div>

	{#if form?.error}
		<p class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.error}</p>
	{/if}

	<form method="POST" class="space-y-5">
		<div>
			<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Full name</label>
			<input id="name" name="name" type="text" required class="input w-full" placeholder="Juan García" />
		</div>

		<div>
			<label for="email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input id="email" name="email" type="email" required class="input w-full" placeholder="juan@example.com" />
		</div>

		<div>
			<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">Phone <span class="text-muted">(optional)</span></label>
			<input id="phone" name="phone" type="tel" class="input w-full" placeholder="+34 600 000 000" />
		</div>

		<div>
			<p class="mb-2 block text-sm font-medium text-gray-700">Roles <span class="text-muted">(select all that apply)</span></p>
			<div class="space-y-2">
				{#each [
					{ value: 'instructor', label: 'Instructor', desc: 'Own sessions only' },
					{ value: 'manager',   label: 'Manager',    desc: 'Full operations, no pricing' },
					{ value: 'owner',     label: 'Owner',      desc: 'Full access' },
					{ value: 'admin',     label: 'Admin',      desc: 'Full system access' }
				] as r}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-border hover:bg-sand">
						<input type="checkbox" name="roles" value={r.value} class="h-4 w-4 rounded border-gray-300 text-ocean" />
						<span class="flex-1">
							<span class="text-sm font-medium text-gray-800">{r.label}</span>
							<span class="ml-2 text-xs text-muted">{r.desc}</span>
						</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="rounded-lg bg-sand p-3 text-sm text-muted">
			A temporary password will be generated and emailed to the staff member.
		</div>

		<div class="flex gap-3 pt-2">
			<button type="submit" class="btn-primary">Send invite</button>
			<a href="/staff" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
```

- [ ] **Step 6.7: Commit**

```bash
git add "src/routes/(app)/staff/"
git commit -m "feat: staff pages — remove instructor profile linking, add phone/bio/active editing"
```

---

### Task 7: API routes

**Files:**
- Modify: `src/routes/api/v1/instructors/+server.ts`
- Modify: `src/routes/api/v1/sessions/upcoming/+server.ts`

- [ ] **Step 7.1: Rewrite `src/routes/api/v1/instructors/+server.ts`**

GET returns users with instructor role. Remove POST (instructor creation now goes through staff invite). Full replacement:

```typescript
import { apiResponse, requireAuth } from '$lib/server/api-helpers';
import { listInstructors } from '$lib/features/instructors/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authError = requireAuth(event);
	if (authError) return authError;
	return apiResponse(await listInstructors());
};
```

- [ ] **Step 7.2: Update `src/routes/api/v1/sessions/upcoming/+server.ts`**

Replace the instructor join against `instructors` table with a join against `user`. Read the file, then:

Change the import on line 16:
```typescript
// REMOVE:
import { sessionInstructors, instructors } from '$lib/server/db/schema';
// ADD:
import { sessionInstructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
```

Replace the instructor query (~lines 92–99):
```typescript
const instrRows = await db
	.select({
		sessionId: sessionInstructors.sessionId,
		instructorName: userTable.name
	})
	.from(sessionInstructors)
	.leftJoin(userTable, eq(sessionInstructors.instructorId, userTable.id))
	.where(sql`${sessionInstructors.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)}]::text[])`);
```

- [ ] **Step 7.3: Commit**

```bash
git add "src/routes/api/"
git commit -m "feat: API routes — instructors endpoint returns users, sessions/upcoming joins user"
```

---

### Task 8: App.Locals type + hooks — expose phone/bio/active

**Files:**
- Modify: `src/app.d.ts`
- Modify: `src/hooks.server.ts`

- [ ] **Step 8.1: Update `src/app.d.ts`**

Add `phone`, `bio`, `active` to the user type in `Locals`:

```typescript
declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image: string | null;
				createdAt: Date;
				updatedAt: Date;
				role: string | null;
				roles: string[];
				banned: boolean | null;
				banReason: string | null;
				banExpires: Date | null;
				phone: string | null;
				bio: string | null;
				active: boolean;
			};
			session?: {
				id: string;
				expiresAt: Date;
				token: string;
				userId: string;
				ipAddress?: string | null;
				userAgent?: string | null;
			};
		}
	}
}

export {};
```

- [ ] **Step 8.2: Update `src/hooks.server.ts`**

Add `phone`, `bio`, `active` to the user object spreading:

```typescript
const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		const rawRoles = (session.user as Record<string, unknown>).roles as string[] | null | undefined;
		const singleRole = (session.user as Record<string, unknown>).role as string | null | undefined;
		const roles: string[] = rawRoles?.length
			? rawRoles
			: singleRole
				? [singleRole]
				: [];
		event.locals.session = session.session;
		event.locals.user = {
			...session.user,
			image: session.user.image ?? null,
			role: session.user.role ?? null,
			roles,
			banned: session.user.banned ?? null,
			banReason: session.user.banReason ?? null,
			banExpires: session.user.banExpires ?? null,
			phone: (session.user as Record<string, unknown>).phone as string | null ?? null,
			bio: (session.user as Record<string, unknown>).bio as string | null ?? null,
			active: (session.user as Record<string, unknown>).active as boolean ?? true
		};
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
```

- [ ] **Step 8.3: Commit**

```bash
git add src/app.d.ts src/hooks.server.ts
git commit -m "feat: expose phone/bio/active on locals.user via Better Auth session"
```

---

### Task 9: Type check + fix + deploy

- [ ] **Step 9.1: Run type check**

```bash
pnpm check 2>&1 | grep -E "^src.*Error" | head -30
```

Expected common issues to fix:
- Any remaining import of `instructors` from `'$lib/server/db/schema'` — remove it
- `data.member.active` typed as `boolean | null` — the DB default is `true` so this is safe; cast or use `?? true` where needed
- `session.user.phone` etc. — handled by the `as Record<string, unknown>` cast in hooks

- [ ] **Step 9.2: Fix any type errors found**

For each error, make the minimal fix. If `instructors` is still imported somewhere: remove it. If a `.phone` or `.bio` access complains on `locals.user`: the `app.d.ts` update in Task 8 covers it.

- [ ] **Step 9.3: Final commit and push**

```bash
git add -A
git commit -m "fix: type errors after instructors table removal"
git push origin main
```

GitHub Actions builds the image → deploys → migration `0023_remove_instructors_table.sql` runs on startup → instructors table removed, all data migrated to user table.

---

## Post-deploy verification

After deploy completes:

1. Log in as David (admin) → go to `/staff` → all users appear with roles
2. Go to `/staff/{id}` for an instructor → phone/bio/active fields present
3. Go to calendar day view → instructor dropdown shows users with instructor role
4. Assign a session to an instructor → session appears in their filtered calendar
5. Check `/api/v1/instructors` returns users with instructor role
