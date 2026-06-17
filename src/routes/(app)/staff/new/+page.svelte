<script lang="ts">
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { form }: { form: ActionData } = $props();
	let copied = $state(false);

	function copyPassword() {
		if (!form?.tempPassword) return;
		navigator.clipboard.writeText(form.tempPassword).then(() => {
			copied = true;
			setTimeout(() => copied = false, 2000);
		});
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/staff" class="text-sm text-muted hover:text-navy">← Staff</a>
		<h1 class="text-xl font-bold text-navy">{m.staff_new_title()}</h1>
	</div>

	{#if form?.created}
		<!-- Success: show created user + temp password -->
		<div class="rounded-(--radius-card) bg-green-50 p-5 ring-1 ring-green-200 space-y-4">
			<div class="flex items-center gap-2">
				<span class="text-green-600 text-lg">✓</span>
				<p class="font-semibold text-green-800">Usuario creado</p>
			</div>
			<div class="text-sm text-green-700 space-y-1">
				<p><span class="font-medium">Nombre:</span> {form.name}</p>
				<p><span class="font-medium">Email:</span> {form.email}</p>
			</div>
			<div class="rounded-lg border border-green-200 bg-white p-3">
				<p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">Contraseña temporal</p>
				<div class="flex items-center gap-2">
					<code class="flex-1 rounded bg-gray-100 px-2 py-1.5 font-mono text-sm text-gray-900">{form.tempPassword}</code>
					<button type="button" onclick={copyPassword}
						class="shrink-0 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors">
						{copied ? '✓ Copiado' : 'Copiar'}
					</button>
				</div>
				<p class="mt-2 text-xs text-green-600">Comparte esta contraseña con el usuario. Si el email se ha enviado correctamente, también la recibirá por correo.</p>
			</div>
			<div class="flex gap-2 pt-1">
				<a href="/staff/{form.userId}" class="btn-primary btn-sm">Ver perfil</a>
				<a href="/staff" class="btn-secondary btn-sm">← Lista de staff</a>
				<a href="/staff/new" class="btn-ghost btn-sm">Crear otro</a>
			</div>
		</div>
	{:else}
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
				Se creará la cuenta directamente. La contraseña temporal se mostrará en pantalla y se enviará por email si el servicio está configurado.
			</div>

			<div class="flex gap-3 pt-2">
				<button type="submit" class="btn-primary">{m.staff_new_submit()}</button>
				<a href="/staff" class="btn-secondary">{m.common_cancel()}</a>
			</div>
		</form>
	{/if}
</div>
