<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let savingName = $state(false);
	let savingPassword = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<h1 class="mb-6 text-xl font-bold text-navy">{m.settings_title()}</h1>

	<!-- Account -->
	<section class="mb-6 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">{m.settings_account()}</h2>

		<div class="mb-4">
			<p class="text-xs text-muted">{m.common_email()}</p>
			<p class="mt-0.5 text-sm font-medium text-gray-800">{data.user.email}</p>
		</div>

		<form
			method="post"
			action="?/updateName"
			class="space-y-3"
			use:enhance={() => {
				savingName = true;
				return async ({ update }) => { savingName = false; update(); };
			}}
		>
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700">{m.settings_display_name()}</label>
				<input
					id="name"
					name="name"
					required
					value={data.user.name}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>

			{#if form?.nameError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.nameError}</p>
			{/if}
			{#if form?.nameSuccess}
				<p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{m.settings_name_updated()}</p>
			{/if}

			<button
				type="submit"
				disabled={savingName}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
			>
				{savingName ? m.common_saving() : m.settings_save_name()}
			</button>
		</form>
	</section>

	<!-- Change password -->
	<section class="mb-6 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">{m.settings_change_password()}</h2>

		<form
			method="post"
			action="?/changePassword"
			class="space-y-3"
			use:enhance={() => {
				savingPassword = true;
				return async ({ update }) => { savingPassword = false; update(); };
			}}
		>
			<div>
				<label for="currentPassword" class="mb-1 block text-sm font-medium text-gray-700">
					{m.settings_current_password()}
				</label>
				<div class="relative">
					<input
						id="currentPassword"
						name="currentPassword"
						type={showCurrentPassword ? 'text' : 'password'}
						required
						autocomplete="current-password"
						class="w-full rounded-lg border border-border px-3 py-2.5 pr-10 text-sm focus:border-ocean focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => (showCurrentPassword = !showCurrentPassword)}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-gray-700"
					>
						{showCurrentPassword ? m.settings_hide() : m.settings_show()}
					</button>
				</div>
			</div>

			<div>
				<label for="newPassword" class="mb-1 block text-sm font-medium text-gray-700">
					{m.settings_new_password()}
				</label>
				<div class="relative">
					<input
						id="newPassword"
						name="newPassword"
						type={showNewPassword ? 'text' : 'password'}
						required
						minlength="8"
						autocomplete="new-password"
						class="w-full rounded-lg border border-border px-3 py-2.5 pr-10 text-sm focus:border-ocean focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => (showNewPassword = !showNewPassword)}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-gray-700"
					>
						{showNewPassword ? m.settings_hide() : m.settings_show()}
					</button>
				</div>
				<p class="mt-1 text-xs text-muted">{m.settings_password_hint()}</p>
			</div>

			<div>
				<label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700">
					{m.settings_confirm_password()}
				</label>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					required
					autocomplete="new-password"
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>

			{#if form?.passwordError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.passwordError}</p>
			{/if}
			{#if form?.passwordSuccess}
				<p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{m.settings_password_changed()}</p>
			{/if}

			<button
				type="submit"
				disabled={savingPassword}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
			>
				{savingPassword ? m.common_saving() : m.settings_change_password()}
			</button>
		</form>
	</section>

	<!-- Language -->
	<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.settings_language()}</h2>
		<div class="flex gap-3">
			<a href="/api/set-locale?locale=es&from=/settings"
				class="btn-sm {getLocale() === 'es' ? 'btn-primary' : 'btn-secondary'}">
				{m.settings_language_es()}
			</a>
			<a href="/api/set-locale?locale=en&from=/settings"
				class="btn-sm {getLocale() === 'en' ? 'btn-primary' : 'btn-secondary'}">
				{m.settings_language_en()}
			</a>
		</div>
	</section>

	<!-- Placeholders for future sections -->
	<section class="rounded-(--radius-card) bg-surface p-5 ring-1 ring-border opacity-50">
		<h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{m.settings_notifications()}</h2>
		<p class="text-sm text-muted">{m.settings_notifications_coming_soon()}</p>
	</section>
</div>
