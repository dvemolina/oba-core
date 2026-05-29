<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/instructors" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">New Instructor</h1>
	</div>

	<form method="post" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input name="name" required class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" placeholder="Chris" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input name="phone" type="tel" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input name="email" type="email" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Bio</label>
			<textarea name="bio" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="btn-primary btn-block">
			{loading ? 'Saving…' : 'Save Instructor'}
		</button>
	</form>
</div>
