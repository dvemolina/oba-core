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

	<section class="mb-4 rounded-[var(--radius-card)] bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>
		<p class="text-sm text-gray-700">{data.member.email}</p>
		{#if data.member.banned}
			<p class="mt-1 text-xs font-medium text-red-600">Account is banned</p>
		{/if}
	</section>

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
