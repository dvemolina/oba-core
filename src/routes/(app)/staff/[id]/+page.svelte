<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ALL_ROLES = ['admin', 'owner', 'manager', 'instructor'] as const;
	const ROLE_LABELS = $derived<Record<string, string>>({
		admin: m.staff_new_role_admin(),
		owner: m.staff_new_role_owner(),
		manager: m.staff_new_role_manager(),
		instructor: m.staff_new_role_instructor()
	});
	const ROLE_DESC = $derived<Record<string, string>>({
		admin: m.staff_new_role_admin_desc(),
		owner: m.staff_new_role_owner_desc(),
		manager: m.staff_new_role_manager_desc(),
		instructor: m.staff_new_role_instructor_desc()
	});

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
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.staff_detail_account()}</h2>
		<p class="text-sm text-gray-700">{data.member.email}</p>
		{#if data.member.banned}
			<p class="mt-1 text-xs font-medium text-red-600">{m.staff_detail_account_banned()}</p>
		{/if}
	</section>

	<!-- Roles -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.staff_detail_roles()}</h2>
		<p class="mb-3 text-xs text-muted">{m.staff_detail_roles_hint()}</p>
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
				<button type="submit" class="btn-primary btn-sm">{m.staff_detail_save_roles()}</button>
			</div>
		</form>
	</section>

	<!-- Profile (phone/bio/active) -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.staff_detail_profile()}</h2>
		<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
			<div>
				<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">{m.common_phone()}</label>
				<input id="phone" name="phone" type="tel" value={data.member.phone ?? ''} class="input w-full" placeholder="+34 600 000 000" />
			</div>
			<div>
				<label for="bio" class="mb-1 block text-sm font-medium text-gray-700">{m.staff_detail_bio()}</label>
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
					<span class="text-sm font-medium text-gray-700">{m.staff_detail_active()}</span>
				</label>
			</div>
			<button type="submit" class="btn-primary btn-sm">{m.staff_detail_save_profile()}</button>
		</form>
	</section>

	<!-- Access -->
	<section class="rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.staff_detail_access()}</h2>
		<form method="POST" action="?/toggleBan" use:enhance>
			<button
				type="submit"
				class="{data.member.banned ? 'btn-primary' : 'btn-danger'} btn-sm"
				onclick={(e) => { if (!confirm(data.member.banned ? m.staff_detail_confirm_restore() : m.staff_detail_confirm_ban())) e.preventDefault(); }}
			>
				{data.member.banned ? m.staff_detail_restore_access() : m.staff_detail_ban()}
			</button>
		</form>
	</section>
</div>
