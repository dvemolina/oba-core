<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/instructors" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">{data.instructor.name}</h1>
		<form method="post" action="?/toggle" use:enhance class="ml-auto">
			<button type="submit" class="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 {data.instructor.active ? 'ring-border text-muted' : 'ring-confirmed text-confirmed'}">
				{data.instructor.active ? 'Deactivate' : 'Activate'}
			</button>
		</form>
	</div>

	<form method="post" action="?/update" class="space-y-4" use:enhance={() => { loading = true; return async ({ update }) => { loading = false; update(); }; }}>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input name="name" required value={data.instructor.name} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
			<input name="phone" type="tel" value={data.instructor.phone ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input name="email" type="email" value={data.instructor.email ?? ''} class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Bio</label>
			<textarea name="bio" rows="2" class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">{data.instructor.bio ?? ''}</textarea>
		</div>
		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}
		<button type="submit" disabled={loading} class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60">
			{loading ? 'Saving…' : 'Save Changes'}
		</button>
	</form>
</div>
