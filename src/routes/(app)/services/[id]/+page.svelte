<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">Edit Service</h1>
		<div class="ml-auto flex items-center gap-2">
			<form method="post" action="?/toggle" use:enhance>
				<button
					type="submit"
					class="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 {data.service.active
						? 'ring-border text-muted hover:text-gray-700'
						: 'ring-confirmed text-confirmed'}"
				>
					{data.service.active ? 'Deactivate' : 'Activate'}
				</button>
			</form>
			<form
				method="post"
				action="?/delete"
				use:enhance
				onsubmit={(e) => { if (!confirm('Delete this service permanently?')) e.preventDefault(); }}
			>
				<button
					type="submit"
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-flexible ring-1 ring-flexible hover:bg-flexible/5"
				>
					Delete
				</button>
			</form>
		</div>
	</div>

	<form
		method="post"
		action="?/update"
		class="space-y-4"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input
				name="name"
				required
				value={data.service.name}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Type *</label>
			<select
				name="type"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				{#each ['lesson', 'camp', 'product', 'rental'] as t}
					<option value={t} selected={data.service.type === t}>{t}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
			<input
				name="durationMinutes"
				type="number"
				min="15"
				step="15"
				value={data.service.durationMinutes ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Base price (€) *</label>
			<input
				name="basePrice"
				type="number"
				step="0.01"
				min="0"
				required
				value={data.service.basePrice}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea
				name="description"
				rows="3"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>{data.service.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Changes'}
		</button>
	</form>
</div>
