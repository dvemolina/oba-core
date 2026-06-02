# Staff Management + RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based access control (admin/owner/manager/instructor) with a `/staff` page replacing `/instructors`, a staff invite flow that emails temp credentials, and permission-filtered views throughout the app.

**Architecture:** Better Auth admin plugin adds `role` + `banned` columns to the auth `user` table via a Drizzle migration. A central `permissions.ts` provides all role guards. The `/instructors` route is deleted and replaced by `/staff`, which combines user accounts (from auth) with instructor profiles (from the `instructors` table, linked via `userId` FK). New staff are created via `auth.api.signUpEmail` + direct DB role update, then emailed temp credentials via nodemailer + Zoho SMTP. Calendar and booking queries gain an optional `instructorId` filter used when the logged-in user has the instructor role.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Better Auth + admin plugin, Drizzle ORM, PostgreSQL, Tailwind CSS v4, nodemailer

---

## File Map

**New files:**
- `src/lib/server/permissions.ts` — role type, guards, helpers
- `src/lib/server/email/sender.ts` — nodemailer Zoho SMTP + invite email builder
- `src/routes/(app)/staff/+page.server.ts`
- `src/routes/(app)/staff/+page.svelte`
- `src/routes/(app)/staff/new/+page.server.ts`
- `src/routes/(app)/staff/new/+page.svelte`
- `src/routes/(app)/staff/[id]/+page.server.ts`
- `src/routes/(app)/staff/[id]/+page.svelte`
- `drizzle/0021_add_role_to_user.sql`

**Modified files:**
- `package.json` — add nodemailer + @types/nodemailer
- `src/lib/server/auth.ts` — add admin plugin
- `src/lib/server/db/auth.schema.ts` — add role/banned columns to user table
- `src/app.d.ts` — update Locals.user type to include role/banned
- `src/routes/(app)/+layout.server.ts` — return role in data
- `src/lib/components/nav/Sidebar.svelte` — role-filtered nav items
- `src/lib/components/nav/BottomNav.svelte` — role-filtered nav items
- `src/routes/(app)/bookings/[id]/+page.server.ts` — pass role to page data
- `src/routes/(app)/bookings/[id]/+page.svelte` — hide payment fields for manager/instructor
- `src/routes/(app)/services/[id]/+page.server.ts` — block instructor, pass role
- `src/routes/(app)/services/[id]/+page.svelte` — hide price for manager
- `src/routes/(app)/clients/+page.server.ts` — block instructor
- `src/routes/(app)/clients/[id]/+page.server.ts` — block instructor
- `src/routes/(app)/calendar/+page.server.ts` — filter sessions/bookings for instructor
- `src/lib/features/sessions/queries.ts` — add instructorId filter to listSessionsForDate + listSessionsForDateRange
- `deploy/oba-stack.yml` — add oba_smtp_user + oba_smtp_pass secrets
- `scripts/start.sh` — load SMTP_USER and SMTP_PASS from Docker secrets

**Deleted:**
- `src/routes/(app)/instructors/` — all 6 files replaced by staff route

---

### Task 1: Dependencies + Better Auth admin plugin + schema migration

**Files:**
- Modify: `package.json`
- Modify: `src/lib/server/auth.ts`
- Modify: `src/lib/server/db/auth.schema.ts`
- Create: `drizzle/0021_add_role_to_user.sql`

- [ ] **Step 1.1: Install nodemailer**

```bash
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

- [ ] **Step 1.2: Add admin plugin to auth.ts**

Full replacement of `src/lib/server/auth.ts`:

```typescript
import { betterAuth } from 'better-auth/minimal';
import { admin } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	plugins: [
		admin({ defaultRole: 'instructor' }),
		sveltekitCookies(getRequestEvent)
	]
});
```

- [ ] **Step 1.3: Add role/banned columns to auth.schema.ts**

Read `src/lib/server/db/auth.schema.ts`. Find the `user` pgTable definition and add four columns at the end of the column list:

```typescript
role: text('role'),
banned: boolean('banned'),
banReason: text('banReason'),
banExpires: timestamp('banExpires')
```

The full updated user table should look like:
```typescript
export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('emailVerified').notNull(),
	image: text('image'),
	createdAt: timestamp('createdAt').notNull(),
	updatedAt: timestamp('updatedAt').notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('banReason'),
	banExpires: timestamp('banExpires')
});
```

- [ ] **Step 1.4: Create migration**

Create `drizzle/0021_add_role_to_user.sql`:

```sql
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" timestamp;

UPDATE "user" SET "role" = 'admin' WHERE "email" = 'dvemolina@gmail.com';
UPDATE "user" SET "role" = 'owner' WHERE "email" IN ('crisesteve1503@gmail.com', 'patripaucastello@gmail.com');
```

- [ ] **Step 1.5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/server/auth.ts src/lib/server/db/auth.schema.ts drizzle/0021_add_role_to_user.sql
git commit -m "feat: Better Auth admin plugin, role/banned schema, nodemailer"
```

---

### Task 2: Permissions helper + type update

**Files:**
- Create: `src/lib/server/permissions.ts`
- Modify: `src/app.d.ts`
- Modify: `src/routes/(app)/+layout.server.ts`

- [ ] **Step 2.1: Create src/lib/server/permissions.ts**

```typescript
import { redirect } from '@sveltejs/kit';

export type Role = 'admin' | 'owner' | 'manager' | 'instructor';

export function userRole(locals: App.Locals): Role | null {
	return (locals.user?.role as Role) ?? null;
}

export function hasRole(locals: App.Locals, ...roles: Role[]): boolean {
	const role = userRole(locals);
	return role !== null && (roles as string[]).includes(role);
}

export function requireRole(locals: App.Locals, ...roles: Role[]): void {
	if (!hasRole(locals, ...roles)) redirect(302, '/');
}

export function canManageStaff(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function canSeeFinancials(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function canEditServices(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function atLeastManager(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner', 'manager');
}

export function isInstructorRole(locals: App.Locals): boolean {
	return hasRole(locals, 'instructor');
}
```

- [ ] **Step 2.2: Update src/app.d.ts**

Full replacement:

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
				banned: boolean | null;
				banReason: string | null;
				banExpires: Date | null;
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

- [ ] **Step 2.3: Update src/routes/(app)/+layout.server.ts**

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/auth/login');
	return { user: locals.user, role: locals.user.role ?? 'instructor' };
};
```

- [ ] **Step 2.4: Commit**

```bash
git add src/lib/server/permissions.ts src/app.d.ts src/routes/(app)/+layout.server.ts
git commit -m "feat: permissions helper, role types, layout passes role"
```

---

### Task 3: Email service

**Files:**
- Create: `src/lib/server/email/sender.ts`

- [ ] **Step 3.1: Create src/lib/server/email/sender.ts**

```typescript
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export interface StaffInviteOptions {
	to: string;
	name: string;
	role: string;
	tempPassword: string;
}

const ROLE_LABELS: Record<string, string> = {
	admin: 'Administrator',
	owner: 'Owner',
	manager: 'Manager',
	instructor: 'Instructor'
};

export async function sendStaffInvite(opts: StaffInviteOptions): Promise<void> {
	if (!env.SMTP_USER || !env.SMTP_PASS) {
		console.warn('[EMAIL] SMTP not configured — skipping invite for', opts.to);
		return;
	}

	const transport = nodemailer.createTransport({
		host: 'smtp.zoho.com',
		port: 587,
		secure: false,
		auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
	});

	const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;
	const loginUrl = `${env.ORIGIN}/auth/login`;

	const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a2e;">
  <h2 style="color:#0a3d62;margin-bottom:8px;">Welcome to OBA Core</h2>
  <p>Hi ${opts.name},</p>
  <p>You have been added as a <strong>${roleLabel}</strong> at Tipiti Surf School.</p>
  <table style="background:#f5f5f5;border-radius:8px;padding:16px;width:100%;margin:24px 0;">
    <tr><td style="padding:4px 8px;font-weight:600;">Email</td><td style="padding:4px 8px;">${opts.to}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:600;">Password</td><td style="padding:4px 8px;font-family:monospace;">${opts.tempPassword}</td></tr>
  </table>
  <a href="${loginUrl}" style="display:inline-block;background:#0a3d62;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Log in</a>
  <p style="margin-top:24px;font-size:13px;color:#666;">Please change your password in Settings after your first login.</p>
</body>
</html>`;

	await transport.sendMail({
		from: `OBA Core <${env.SMTP_USER}>`,
		to: opts.to,
		subject: 'You have been added to OBA Core',
		html
	});

	console.log('[EMAIL] Invite sent to', opts.to);
}

export function generateTempPassword(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
	return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/lib/server/email/
git commit -m "feat: email invite service via nodemailer + Zoho SMTP"
```

---

### Task 4: Staff list page (replaces instructors list)

**Files:**
- Delete: `src/routes/(app)/instructors/+page.server.ts`
- Delete: `src/routes/(app)/instructors/+page.svelte`
- Create: `src/routes/(app)/staff/+page.server.ts`
- Create: `src/routes/(app)/staff/+page.svelte`

The staff list queries all auth users + joins instructor profiles via `userId` FK.

- [ ] **Step 4.1: Create src/routes/(app)/staff/+page.server.ts**

```typescript
import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { isNotNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');

	const [users, linkedProfiles] = await Promise.all([
		db.select().from(userTable).orderBy(userTable.name),
		db.select().from(instructors).where(isNotNull(instructors.userId))
	]);

	const profileByUserId = new Map(linkedProfiles.map(p => [p.userId, p]));

	const staff = users.map(u => ({
		...u,
		instructorProfile: profileByUserId.get(u.id) ?? null
	}));

	return { staff };
};
```

- [ ] **Step 4.2: Create src/routes/(app)/staff/+page.svelte**

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const ROLE_COLORS: Record<string, string> = {
		admin:      'bg-red-100 text-red-700',
		owner:      'bg-ocean/10 text-ocean',
		manager:    'bg-purple-100 text-purple-700',
		instructor: 'bg-green-100 text-green-700'
	};

	const ROLE_LABELS: Record<string, string> = {
		admin: 'Admin', owner: 'Owner', manager: 'Manager', instructor: 'Instructor'
	};
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Staff</h1>
		<a href="/staff/new" class="btn-primary btn-sm">+ Invite staff</a>
	</div>

	<div class="space-y-2">
		{#each data.staff as member}
			<a
				href="/staff/{member.id}"
				class="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-lg font-bold text-ocean">
					{member.name[0].toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<p class="font-medium text-gray-800">{member.name}</p>
						{#if member.role}
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-600'}">
								{ROLE_LABELS[member.role] ?? member.role}
							</span>
						{/if}
						{#if member.banned}
							<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">banned</span>
						{/if}
					</div>
					<p class="text-xs text-muted">{member.email}</p>
					{#if member.instructorProfile}
						<p class="text-xs text-muted">↳ Instructor profile: {member.instructorProfile.name}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	{#if data.staff.length === 0}
		<p class="py-12 text-center text-sm text-muted">No staff yet.</p>
	{/if}
</div>
```

- [ ] **Step 4.3: Delete old instructor list files**

```bash
rm src/routes/\(app\)/instructors/+page.server.ts
rm src/routes/\(app\)/instructors/+page.svelte
```

- [ ] **Step 4.4: Commit**

```bash
git add src/routes/\(app\)/staff/ src/routes/\(app\)/instructors/+page.server.ts src/routes/\(app\)/instructors/+page.svelte
git commit -m "feat: staff list page (replaces instructors list)"
```

---

### Task 5: Staff invite form (new staff member)

**Files:**
- Delete: `src/routes/(app)/instructors/new/+page.server.ts`
- Delete: `src/routes/(app)/instructors/new/+page.svelte`
- Create: `src/routes/(app)/staff/new/+page.server.ts`
- Create: `src/routes/(app)/staff/new/+page.svelte`

- [ ] **Step 5.1: Create src/routes/(app)/staff/new/+page.server.ts**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/permissions';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq, isNull } from 'drizzle-orm';
import { sendStaffInvite, generateTempPassword } from '$lib/server/email/sender';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'admin', 'owner');
	const unlinkedProfiles = await db
		.select()
		.from(instructors)
		.where(isNull(instructors.userId))
		.orderBy(instructors.name);
	return { unlinkedProfiles };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireRole(locals, 'admin', 'owner');

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const email = form.get('email')?.toString().trim() ?? '';
		const role = form.get('role')?.toString() ?? 'instructor';
		const instructorProfileId = form.get('instructorProfileId')?.toString() || null;

		if (!name) return fail(400, { error: 'Name is required' });
		if (!email) return fail(400, { error: 'Email is required' });
		if (!['owner', 'manager', 'instructor'].includes(role))
			return fail(400, { error: 'Invalid role' });

		const tempPassword = generateTempPassword();

		const result = await auth.api.signUpEmail({
			body: { name, email, password: tempPassword }
		});

		if (!result?.user) return fail(400, { error: 'Failed to create account (email may already exist)' });

		await db.update(userTable).set({ role }).where(eq(userTable.id, result.user.id));

		if (instructorProfileId) {
			await db
				.update(instructors)
				.set({ userId: result.user.id })
				.where(eq(instructors.id, instructorProfileId));
		}

		await sendStaffInvite({ to: email, name, role, tempPassword });

		redirect(302, '/staff');
	}
};
```

- [ ] **Step 5.2: Create src/routes/(app)/staff/new/+page.svelte**

```svelte
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
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
			<label for="role" class="mb-1 block text-sm font-medium text-gray-700">Role</label>
			<select id="role" name="role" class="input w-full">
				<option value="instructor">Instructor — own sessions only</option>
				<option value="manager">Manager — full operations, no pricing</option>
				<option value="owner">Owner — full access</option>
			</select>
		</div>

		{#if data.unlinkedProfiles.length > 0}
			<div>
				<label for="instructorProfileId" class="mb-1 block text-sm font-medium text-gray-700">
					Link to instructor profile <span class="text-muted">(optional)</span>
				</label>
				<select id="instructorProfileId" name="instructorProfileId" class="input w-full">
					<option value="">— none —</option>
					{#each data.unlinkedProfiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-muted">Only unlinked instructor profiles are shown</p>
			</div>
		{/if}

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

- [ ] **Step 5.3: Delete old instructor new files**

```bash
rm src/routes/\(app\)/instructors/new/+page.server.ts
rm src/routes/\(app\)/instructors/new/+page.svelte
```

- [ ] **Step 5.4: Commit**

```bash
git add src/routes/\(app\)/staff/new/ src/routes/\(app\)/instructors/new/
git commit -m "feat: staff invite form — create user, set role, send email"
```

---

### Task 6: Staff detail page (edit role, link profile, deactivate)

**Files:**
- Delete: `src/routes/(app)/instructors/[id]/+page.server.ts`
- Delete: `src/routes/(app)/instructors/[id]/+page.svelte`
- Create: `src/routes/(app)/staff/[id]/+page.server.ts`
- Create: `src/routes/(app)/staff/[id]/+page.svelte`

- [ ] **Step 6.1: Create src/routes/(app)/staff/[id]/+page.server.ts**

```typescript
import { error, fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/permissions';
import { db } from '$lib/server/db';
import { instructors } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';
import { eq, isNull, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner');

	const [member] = await db.select().from(userTable).where(eq(userTable.id, params.id));
	if (!member) error(404, 'Staff member not found');

	const [linkedProfile] = await db
		.select()
		.from(instructors)
		.where(eq(instructors.userId, params.id));

	const unlinkedProfiles = await db
		.select()
		.from(instructors)
		.where(isNull(instructors.userId))
		.orderBy(instructors.name);

	return { member, linkedProfile: linkedProfile ?? null, unlinkedProfiles };
};

export const actions: Actions = {
	updateRole: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const role = form.get('role')?.toString() ?? '';
		if (!['admin', 'owner', 'manager', 'instructor'].includes(role))
			return fail(400, { error: 'Invalid role' });
		await db.update(userTable).set({ role }).where(eq(userTable.id, params.id));
		return { success: true };
	},

	linkProfile: async ({ request, params, locals }) => {
		requireRole(locals, 'admin', 'owner');
		const form = await request.formData();
		const instructorProfileId = form.get('instructorProfileId')?.toString() ?? '';

		await db.update(instructors).set({ userId: null }).where(eq(instructors.userId, params.id));

		if (instructorProfileId) {
			await db
				.update(instructors)
				.set({ userId: params.id })
				.where(eq(instructors.id, instructorProfileId));
		}
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

- [ ] **Step 6.2: Create src/routes/(app)/staff/[id]/+page.svelte**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ROLE_LABELS: Record<string, string> = {
		admin: 'Admin', owner: 'Owner', manager: 'Manager', instructor: 'Instructor'
	};
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
	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>
		<p class="text-sm text-gray-700">{data.member.email}</p>
		{#if data.member.banned}
			<p class="mt-1 text-xs text-red-600 font-medium">Account is banned</p>
		{/if}
	</section>

	<!-- Role -->
	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Role</h2>
		<form method="POST" action="?/updateRole" use:enhance class="flex items-center gap-3">
			<select name="role" class="input flex-1">
				{#each ['instructor', 'manager', 'owner', 'admin'] as r}
					<option value={r} selected={data.member.role === r}>{ROLE_LABELS[r]}</option>
				{/each}
			</select>
			<button type="submit" class="btn-primary btn-sm">Save</button>
		</form>
	</section>

	<!-- Instructor profile link -->
	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Instructor profile</h2>
		{#if data.linkedProfile}
			<p class="mb-3 text-sm text-gray-700">Linked: <strong>{data.linkedProfile.name}</strong></p>
		{/if}
		<form method="POST" action="?/linkProfile" use:enhance class="flex items-center gap-3">
			<select name="instructorProfileId" class="input flex-1">
				<option value="">— unlink —</option>
				{#if data.linkedProfile}
					<option value={data.linkedProfile.id} selected>{data.linkedProfile.name} (current)</option>
				{/if}
				{#each data.unlinkedProfiles as p}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
			<button type="submit" class="btn-primary btn-sm">Save</button>
		</form>
	</section>

	<!-- Ban / unban -->
	<section class="rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
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

- [ ] **Step 6.3: Delete old instructor detail files**

```bash
rm src/routes/\(app\)/instructors/\[id\]/+page.server.ts
rm src/routes/\(app\)/instructors/\[id\]/+page.svelte
rmdir src/routes/\(app\)/instructors/\[id\] src/routes/\(app\)/instructors/new src/routes/\(app\)/instructors
```

- [ ] **Step 6.4: Commit**

```bash
git add src/routes/\(app\)/staff/\[id\]/ src/routes/\(app\)/instructors/
git commit -m "feat: staff detail page — edit role, link instructor profile, ban"
```

---

### Task 7: Update nav to use /staff and filter by role

**Files:**
- Modify: `src/lib/components/nav/Sidebar.svelte`
- Modify: `src/lib/components/nav/BottomNav.svelte`
- Modify: `src/routes/(app)/+layout.svelte`

The nav receives role from layout data and conditionally shows items.

- [ ] **Step 7.1: Update +layout.svelte to pass role to nav components**

Read `src/routes/(app)/+layout.svelte`. Add a script block to receive layout data and pass role:

```svelte
<script lang="ts">
	import BottomNav from '$lib/components/nav/BottomNav.svelte';
	import Sidebar from '$lib/components/nav/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	const role = $derived(data.role ?? 'instructor');
</script>

<div class="flex h-screen overflow-hidden bg-sand">
	<Sidebar {role} />
	<main class="min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
		{@render children()}
	</main>
	<BottomNav {role} />
</div>

<Toaster />
```

- [ ] **Step 7.2: Update Sidebar.svelte to accept role and filter nav**

Full replacement of `src/lib/components/nav/Sidebar.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, BookOpen, Users, UserCheck, LayoutGrid, Settings, Waves, Sun } from 'lucide-svelte';

	let { role = 'instructor' }: { role: string } = $props();

	const allItems = [
		{ href: '/agenda',    label: 'Today',    icon: Sun,        roles: ['admin','owner','manager','instructor'] },
		{ href: '/calendar',  label: 'Calendar', icon: Calendar,   roles: ['admin','owner','manager','instructor'] },
		{ href: '/bookings',  label: 'Bookings', icon: BookOpen,   roles: ['admin','owner','manager'] },
		{ href: '/clients',   label: 'Clients',  icon: Users,      roles: ['admin','owner','manager'] },
		{ href: '/staff',     label: 'Staff',    icon: UserCheck,  roles: ['admin','owner'] },
		{ href: '/services',  label: 'Services', icon: LayoutGrid, roles: ['admin','owner','manager'] },
	];

	const items = $derived(allItems.filter(i => i.roles.includes(role)));
</script>

<nav
	aria-label="Main navigation"
	class="group hidden shrink-0 flex-col overflow-hidden bg-navy transition-[width] duration-200 ease-out md:flex"
	style="width: 3.75rem;"
	onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.width = '13rem')}
	onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.width = '3.75rem')}
>
	<div class="flex h-14 items-center gap-3 px-3.5 border-b border-white/10">
		<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean text-white">
			<Waves size={16} strokeWidth={2} />
		</span>
		<span class="overflow-hidden whitespace-nowrap text-sm font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
			OBA
		</span>
	</div>

	<div class="flex flex-1 flex-col gap-0.5 p-2 pt-3">
		{#each items as item}
			{@const active = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label}
				class="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150
				       {active ? 'bg-ocean text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'}"
			>
				<span class="flex h-5 w-5 shrink-0 items-center justify-center">
					<item.icon size={18} strokeWidth={active ? 2.5 : 1.75} />
				</span>
				<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
					{item.label}
				</span>
			</a>
		{/each}
	</div>

	<div class="border-t border-white/10 p-2">
		<a
			href="/settings"
			aria-label="Settings"
			class="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150
			       {page.url.pathname.startsWith('/settings') ? 'bg-ocean text-white' : 'text-white/40 hover:bg-white/8 hover:text-white'}"
		>
			<span class="flex h-5 w-5 shrink-0 items-center justify-center">
				<Settings size={18} strokeWidth={page.url.pathname.startsWith('/settings') ? 2.5 : 1.75} />
			</span>
			<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
				Settings
			</span>
		</a>
	</div>
</nav>
```

- [ ] **Step 7.3: Update BottomNav.svelte to accept role and filter nav**

Full replacement of `src/lib/components/nav/BottomNav.svelte`. Key change: replace `/instructors` with `/staff`, add role prop, filter items. Only show `mainItems` that the role can access (show max 4 in bottom bar, rest in More grid):

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Calendar, BookOpen, Users, LayoutGrid, Sun, UserCheck, Settings, Grid2X2, X } from 'lucide-svelte';

	let { role = 'instructor' }: { role: string } = $props();

	const allItems = [
		{ href: '/agenda',    label: 'Today',    icon: Sun,        roles: ['admin','owner','manager','instructor'] },
		{ href: '/calendar',  label: 'Calendar', icon: Calendar,   roles: ['admin','owner','manager','instructor'] },
		{ href: '/bookings',  label: 'Bookings', icon: BookOpen,   roles: ['admin','owner','manager'] },
		{ href: '/clients',   label: 'Clients',  icon: Users,      roles: ['admin','owner','manager'] },
		{ href: '/services',  label: 'Services', icon: LayoutGrid, roles: ['admin','owner','manager'] },
		{ href: '/staff',     label: 'Staff',    icon: UserCheck,  roles: ['admin','owner'] },
		{ href: '/settings',  label: 'Settings', icon: Settings,   roles: ['admin','owner','manager','instructor'] },
	];

	const visibleItems = $derived(allItems.filter(i => i.roles.includes(role)));
	const mainItems = $derived(visibleItems.slice(0, 4));
	const moreItems = $derived(visibleItems);

	let moreOpen = $state(false);
	function close() { moreOpen = false; }
	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<div class="fixed right-0 bottom-0 left-0 z-50 md:hidden">
	{#if moreOpen}
		<div
			transition:fly={{ y: 16, duration: 220, easing: cubicOut }}
			class="border-t border-border bg-surface/98 backdrop-blur-md"
		>
			<div class="grid grid-cols-4 gap-0 px-2 pt-3 pb-1">
				{#each moreItems as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						onclick={close}
						class="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors
						       {active ? 'text-ocean' : 'text-gray-700 hover:bg-sand'}"
					>
						<span class="relative flex h-6 w-6 items-center justify-center">
							{#if active}<span class="absolute inset-0 rounded-lg bg-ocean/12"></span>{/if}
							<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
						</span>
						<span class="text-[10px] font-medium">{item.label}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<nav
		aria-label="Main navigation"
		class="flex justify-around border-t border-border bg-surface/95 backdrop-blur-md"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		{#each mainItems as item}
			{@const active = !moreOpen && isActive(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label}
				onclick={close}
				class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
				       transition-colors duration-150
				       {active ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
			>
				<span class="relative flex h-6 w-6 items-center justify-center">
					{#if active}<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>{/if}
					<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
				</span>
				<span class="truncate">{item.label}</span>
			</a>
		{/each}

		<button
			onclick={() => moreOpen = !moreOpen}
			aria-label={moreOpen ? 'Close menu' : 'More'}
			class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
			       transition-colors duration-150
			       {moreOpen ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
		>
			<span class="relative flex h-6 w-6 items-center justify-center">
				{#if moreOpen}
					<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>
					<X size={20} strokeWidth={2.5} />
				{:else}
					<Grid2X2 size={20} strokeWidth={1.75} />
				{/if}
			</span>
			<span class="truncate">{moreOpen ? 'Close' : 'More'}</span>
		</button>
	</nav>
</div>
```

- [ ] **Step 7.4: Commit**

```bash
git add src/routes/\(app\)/+layout.svelte src/lib/components/nav/
git commit -m "feat: role-filtered nav, /staff replaces /instructors in nav"
```

---

### Task 8: Route guards on bookings, clients, services

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`
- Modify: `src/routes/(app)/clients/+page.server.ts`
- Modify: `src/routes/(app)/clients/[id]/+page.server.ts`
- Modify: `src/routes/(app)/services/[id]/+page.server.ts`
- Modify: `src/routes/(app)/bookings/new/+page.server.ts`

For each of the following, add `requireRole` at the top of the `load` function (and in every action):

- [ ] **Step 8.1: Guard bookings detail and pass role**

In `src/routes/(app)/bookings/[id]/+page.server.ts`, at the top of the `load` function add:

```typescript
// add to imports:
import { atLeastManager, canSeeFinancials } from '$lib/server/permissions';

// at start of load function:
atLeastManager(locals) || (() => { redirect(302, '/'); })();
// then add to return:
return { ..., canSeeFinancials: canSeeFinancials(locals) };
```

More precisely — add `{ locals }` to the load destructure, add the guard, and add `canSeeFinancials` to the return. The full updated load signature:

```typescript
export const load: PageServerLoad = async ({ params, locals }) => {
	requireRole(locals, 'admin', 'owner', 'manager');
	// ... existing queries ...
	return { booking, instructors, service: service ?? null, clients, isCamp, sessions, linkableSessions, allDateSessions, canSeeFinancials: canSeeFinancials(locals) };
};
```

Also add `requireRole(locals, 'admin', 'owner', 'manager')` to each action in that file.

- [ ] **Step 8.2: Guard bookings new**

In `src/routes/(app)/bookings/new/+page.server.ts`, add `{ locals }` to destructure and add `requireRole(locals, 'admin', 'owner', 'manager')` to the load function and all actions. Import `requireRole` from `$lib/server/permissions`.

- [ ] **Step 8.3: Guard clients list**

In `src/routes/(app)/clients/+page.server.ts`, add `{ locals }` and:
```typescript
import { requireRole } from '$lib/server/permissions';
// in load:
requireRole(locals, 'admin', 'owner', 'manager');
```

- [ ] **Step 8.4: Guard clients detail**

In `src/routes/(app)/clients/[id]/+page.server.ts`, same pattern — add guard to load and all actions.

- [ ] **Step 8.5: Guard services detail and pass canEdit**

In `src/routes/(app)/services/[id]/+page.server.ts`, add:
```typescript
import { requireRole, canEditServices } from '$lib/server/permissions';

// In load:
requireRole(locals, 'admin', 'owner', 'manager');
return { ..., canEditServices: canEditServices(locals) };

// In every action (update, delete, addUnitType etc.):
requireRole(locals, 'admin', 'owner');
```

- [ ] **Step 8.6: Guard services new and list**

In `src/routes/(app)/services/+page.server.ts` and `src/routes/(app)/services/new/+page.server.ts`: add `requireRole(locals, 'admin', 'owner', 'manager')` to load, `requireRole(locals, 'admin', 'owner')` to actions.

- [ ] **Step 8.7: Commit**

```bash
git add src/routes/\(app\)/bookings/ src/routes/\(app\)/clients/ src/routes/\(app\)/services/
git commit -m "feat: route guards for bookings, clients, services by role"
```

---

### Task 9: Hide financial data in UI for manager

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`
- Modify: `src/routes/(app)/services/[id]/+page.svelte`

- [ ] **Step 9.1: Hide payment in booking detail for manager**

In `src/routes/(app)/bookings/[id]/+page.svelte`:

Add `canSeeFinancials` to the destructured `data`:
```svelte
<script lang="ts">
	// existing imports...
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const canSeeFinancials = $derived(data.canSeeFinancials);
</script>
```

Find every section that shows payment amounts, payment status, or financial totals (search for `payment`, `price`, `paid`, `amount`, `cost` in the template). Wrap each such section with `{#if canSeeFinancials} ... {/if}`.

- [ ] **Step 9.2: Hide price in services detail for manager**

In `src/routes/(app)/services/[id]/+page.svelte`:

Add `canEditServices` from data:
```svelte
const canEditServices = $derived(data.canEditServices);
```

Wrap all price input fields (`pricePerSession`, `pricePerPerson`, `priceFlat`, etc.) with `{#if canEditServices} ... {/if}`. Show a plain text label with "—" placeholder for manager so the layout doesn't break:
```svelte
{#if canEditServices}
  <input name="pricePerSession" ... />
{:else}
  <p class="text-sm text-muted">Pricing managed by owners</p>
{/if}
```

Also wrap the delete/save action buttons with `{#if canEditServices}`.

- [ ] **Step 9.3: Commit**

```bash
git add src/routes/\(app\)/bookings/\[id\]/+page.svelte src/routes/\(app\)/services/\[id\]/+page.svelte
git commit -m "feat: hide financials/pricing for manager role in UI"
```

---

### Task 10: Instructor-filtered calendar

**Files:**
- Modify: `src/lib/features/sessions/queries.ts`
- Modify: `src/routes/(app)/calendar/+page.server.ts`
- Modify: `src/routes/(app)/agenda/+page.server.ts` (if exists)

When the logged-in user is an instructor, the calendar should show only sessions where their instructor profile is in `sessionInstructors`.

- [ ] **Step 10.1: Add instructorId filter to listSessionsForDate**

In `src/lib/features/sessions/queries.ts`, find `listSessionsForDate`. Add an optional `instructorId` parameter:

```typescript
export async function listSessionsForDate(date: string, instructorId?: string): Promise<SessionForDay[]> {
	const sessionRows = await db
		.select({ /* existing select */ })
		.from(sessions)
		.where(
			instructorId
				? and(
					eq(sessions.date, date),
					ne(sessions.status, 'cancelled'),
					// subquery: session must have this instructor
					sql`${sessions.id} IN (
						SELECT "sessionId" FROM "sessionInstructors" WHERE "instructorId" = ${instructorId}
					)`
				)
				: and(eq(sessions.date, date), ne(sessions.status, 'cancelled'))
		)
		// ... rest unchanged
```

- [ ] **Step 10.2: Add instructorId filter to listSessionsForDateRange**

Same pattern for `listSessionsForDateRange`:

```typescript
export async function listSessionsForDateRange(from: string, to: string, instructorId?: string): Promise<...> {
	// Add instructorId filter to WHERE clause using same SQL subquery pattern
}
```

- [ ] **Step 10.3: Update calendar page.server.ts to pass instructorId**

In `src/routes/(app)/calendar/+page.server.ts`:

```typescript
import { isInstructorRole } from '$lib/server/permissions';
import { instructors } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

// in the load function, after existing setup:
let instructorId: string | undefined;
if (isInstructorRole(locals)) {
	const [profile] = await db
		.select({ id: instructors.id })
		.from(instructors)
		.where(eq(instructors.userId, locals.user!.id));
	instructorId = profile?.id;
}

// then pass instructorId to the queries:
const [bookings, events, daySessions, rangedSessions, instructorsList] = await Promise.all([
	listBookingsForDateRange(from, to),   // bookings not filtered (sessions are the view)
	listEventsForDateRange(from, to),
	view === 'day' ? listSessionsForDate(dayDate, instructorId) : Promise.resolve([]),
	view !== 'day' ? listSessionsForDateRange(from, to, instructorId) : Promise.resolve([]),
	view === 'day' ? listInstructors() : Promise.resolve([])
]);
```

- [ ] **Step 10.4: Check agenda/today page**

If `src/routes/(app)/agenda/+page.server.ts` exists, apply the same `instructorId` filter to any session queries there.

- [ ] **Step 10.5: Commit**

```bash
git add src/lib/features/sessions/queries.ts src/routes/\(app\)/calendar/ src/routes/\(app\)/agenda/
git commit -m "feat: instructor-filtered sessions in calendar and agenda"
```

---

### Task 11: SMTP secrets — Docker + scripts

**Files:**
- Modify: `deploy/oba-stack.yml`
- Modify: `scripts/start.sh`

- [ ] **Step 11.1: Add SMTP secrets to oba-stack.yml**

In `deploy/oba-stack.yml`, add to the top-level `secrets:` block:
```yaml
  oba_smtp_user:
    external: true
  oba_smtp_pass:
    external: true
```

Add to the `app` service `secrets:` list:
```yaml
      - oba_smtp_user
      - oba_smtp_pass
```

Add to the `app` service `environment:` block:
```yaml
      SMTP_USER_FILE: /run/secrets/oba_smtp_user
      SMTP_PASS_FILE: /run/secrets/oba_smtp_pass
```

- [ ] **Step 11.2: Update scripts/start.sh to load SMTP vars**

In `scripts/start.sh`, add `SMTP_USER` and `SMTP_PASS` to the secrets loop:

```sh
for var in DATABASE_URL BETTER_AUTH_SECRET INTERNAL_API_KEY SMTP_USER SMTP_PASS; do
  file_var="${var}_FILE"
  file_path=$(eval echo "\$$file_var")
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    export "$var=$(cat "$file_path")"
  fi
done
```

- [ ] **Step 11.3: Create Docker secrets on VPS**

```bash
# Run locally — prompts for Zoho password
ssh -p 99 dvemolina@contabo "printf 'hello@tipitisurf.com' | docker secret create oba_smtp_user -"
# For the password, run interactively:
ssh -p 99 dvemolina@contabo
# then on VPS:
# printf 'YOUR_ZOHO_PASSWORD' | docker secret create oba_smtp_pass -
```

- [ ] **Step 11.4: Commit**

```bash
git add deploy/oba-stack.yml scripts/start.sh
git commit -m "feat: SMTP secrets wired to Docker Swarm and start script"
```

---

### Task 12: Fix remaining /instructors references

- [ ] **Step 12.1: Search for any remaining /instructors hrefs**

```bash
grep -r '/instructors' src/ --include='*.ts' --include='*.svelte' -l
```

Update any remaining references from `/instructors` to `/staff`. These might be in redirect calls or service detail pages that list instructors.

- [ ] **Step 12.2: Check services/[id]/+page.server.ts**

The services detail page imports `listInstructors` from `$lib/features/instructors/queries`. This import path remains valid (the feature module is not being renamed, only the route). No change needed — just confirm.

- [ ] **Step 12.3: Commit fixes**

```bash
git add -A
git commit -m "fix: update remaining /instructors references to /staff"
```

---

### Task 13: Build check + push to deploy

- [ ] **Step 13.1: Run type check**

```bash
pnpm check
```

Fix any TypeScript errors. Common issues:
- `data.canSeeFinancials` not typed — update `+page.server.ts` return type or add `satisfies` annotation
- `locals.user` might be undefined — use `locals.user?.role` with null coalescing in permissions.ts

- [ ] **Step 13.2: Commit and push**

```bash
git add -A
git commit -m "fix: type errors from RBAC implementation"
git push origin main
```

This triggers GitHub Actions → builds image → deploys stack → migration `0021_add_role_to_user.sql` runs on startup → Daniel gets `admin`, Patri and Cris get `owner`.

---

## Access summary after deploy

| Route | admin | owner | manager | instructor |
|-------|-------|-------|---------|------------|
| `/calendar` | ✅ all | ✅ all | ✅ all | ✅ own sessions |
| `/agenda` | ✅ | ✅ | ✅ | ✅ own sessions |
| `/bookings` | ✅ | ✅ | ✅ (no payment $) | ❌ redirect |
| `/clients` | ✅ | ✅ | ✅ | ❌ redirect |
| `/services` | ✅ | ✅ | ✅ read, no prices | ❌ redirect |
| `/staff` | ✅ | ✅ | ❌ redirect | ❌ redirect |
| `/settings` | ✅ | ✅ | ✅ | ✅ |
