<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/clients" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">{m.client_new_title()}</h1>
	</div>

	<form
		method="post"
		class="space-y-4"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				update();
			};
		}}
	>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">{m.client_new_first_name()}</label>
				<input
					name="firstName"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">{m.client_new_last_name()}</label>
				<input
					name="lastName"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.common_phone()}</label>
			<input
				name="phone"
				type="tel"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.common_email()}</label>
			<input
				name="email"
				type="email"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.client_new_nationality()}</label>
			<input
				name="nationality"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder={m.client_new_nationality_placeholder()}
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.client_new_skill_level()}</label>
			<select
				name="skillLevel"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">{m.client_new_skill_not_set()}</option>
				<option value="beginner">{m.client_new_skill_beginner()}</option>
				<option value="intermediate">{m.client_new_skill_intermediate()}</option>
				<option value="advanced">{m.client_new_skill_advanced()}</option>
			</select>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.common_notes()}</label>
			<textarea
				name="notes"
				rows="2"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			></textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button
			type="submit"
			disabled={loading}
			class="btn-primary btn-block"
		>
			{loading ? m.common_saving() : m.client_new_submit()}
		</button>
	</form>
</div>
