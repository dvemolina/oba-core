<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/clients" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">New Client</h1>
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
				<label class="mb-1 block text-sm font-medium text-gray-700">First name *</label>
				<input
					name="firstName"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Last name *</label>
				<input
					name="lastName"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input
				name="phone"
				type="tel"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input
				name="email"
				type="email"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
			<input
				name="nationality"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="e.g. Portuguese"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Skill level</label>
			<select
				name="skillLevel"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">— not set —</option>
				<option value="beginner">Beginner</option>
				<option value="intermediate">Intermediate</option>
				<option value="advanced">Advanced</option>
			</select>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
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
			{loading ? 'Saving…' : 'Save Client'}
		</button>
	</form>
</div>
