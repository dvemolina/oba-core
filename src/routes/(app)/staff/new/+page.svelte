<script lang="ts">
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/staff" class="text-sm text-muted hover:text-navy">← Staff</a>
		<h1 class="text-xl font-bold text-navy">{m.staff_new_title()}</h1>
	</div>

	{#if form?.error}
		<p class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.error}</p>
	{/if}

	<form method="POST" class="space-y-5">
		<div>
			<label for="name" class="mb-1 block text-sm font-medium text-gray-700">{m.staff_new_full_name()}</label>
			<input id="name" name="name" type="text" required class="input w-full" placeholder="Juan García" />
		</div>

		<div>
			<label for="email" class="mb-1 block text-sm font-medium text-gray-700">{m.common_email()}</label>
			<input id="email" name="email" type="email" required class="input w-full" placeholder="juan@example.com" />
		</div>

		<div>
			<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">{m.common_phone()} <span class="text-muted">({m.common_optional()})</span></label>
			<input id="phone" name="phone" type="tel" class="input w-full" placeholder="+34 600 000 000" />
		</div>

		<div>
			<p class="mb-2 block text-sm font-medium text-gray-700">{m.staff_new_roles()} <span class="text-muted">({m.staff_new_roles_hint()})</span></p>
			<div class="space-y-2">
				{#each [
					{ value: 'instructor', label: m.staff_new_role_instructor(), desc: m.staff_new_role_instructor_desc() },
					{ value: 'manager',   label: m.staff_new_role_manager(),    desc: m.staff_new_role_manager_desc() },
					{ value: 'owner',     label: m.staff_new_role_owner(),      desc: m.staff_new_role_owner_desc() },
					{ value: 'admin',     label: m.staff_new_role_admin(),      desc: m.staff_new_role_admin_desc() }
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
			{m.staff_new_temp_password_notice()}
		</div>

		<div class="flex gap-3 pt-2">
			<button type="submit" class="btn-primary">{m.staff_new_submit()}</button>
			<a href="/staff" class="btn-secondary">{m.common_cancel()}</a>
		</div>
	</form>
</div>
