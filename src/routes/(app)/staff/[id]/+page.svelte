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
		data.isAdmin
			? ALL_ROLES
			: ALL_ROLES.filter(r => r !== 'admin')
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

	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>
		<p class="text-sm text-gray-700">{data.member.email}</p>
		{#if data.member.banned}
			<p class="mt-1 text-xs font-medium text-red-600">Account is banned</p>
		{/if}
	</section>

	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
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
