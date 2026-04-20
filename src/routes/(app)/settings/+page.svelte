<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let savingName = $state(false);
	let savingPassword = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<h1 class="mb-6 text-xl font-bold text-navy">Settings</h1>

	<!-- Account -->
	<section class="mb-6 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>

		<div class="mb-4">
			<p class="text-xs text-muted">Email</p>
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
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Display name</label>
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
				<p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Name updated.</p>
			{/if}

			<button
				type="submit"
				disabled={savingName}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
			>
				{savingName ? 'Saving…' : 'Save name'}
			</button>
		</form>
	</section>

	<!-- Change password -->
	<section class="mb-6 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
		<h2 class="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Change Password</h2>

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
					Current password
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
						{showCurrentPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<div>
				<label for="newPassword" class="mb-1 block text-sm font-medium text-gray-700">
					New password
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
						{showNewPassword ? 'Hide' : 'Show'}
					</button>
				</div>
				<p class="mt-1 text-xs text-muted">Minimum 8 characters</p>
			</div>

			<div>
				<label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700">
					Confirm new password
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
				<p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Password changed successfully.</p>
			{/if}

			<button
				type="submit"
				disabled={savingPassword}
				class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
			>
				{savingPassword ? 'Saving…' : 'Change password'}
			</button>
		</form>
	</section>

	<!-- Placeholders for future sections -->
	<section class="rounded-(--radius-card) bg-surface p-5 ring-1 ring-border opacity-50">
		<h2 class="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Notifications & Templates</h2>
		<p class="text-sm text-muted">Email and messaging templates — coming soon.</p>
	</section>
</div>
