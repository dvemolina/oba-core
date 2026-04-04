<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let selectedType = $state('lesson');
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Service</h1>
	</div>

	<form
		method="post"
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
				value={form?.values?.name ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="Group Surf Lesson"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Type *</label>
			<select
				name="type"
				bind:value={selectedType}
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="lesson">Lesson</option>
				<option value="camp">Camp</option>
				<option value="product">Product</option>
				<option value="rental">Rental</option>
			</select>
		</div>

		{#if selectedType === 'lesson' || selectedType === 'camp'}
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
				<input
					name="durationMinutes"
					type="number"
					min="15"
					step="15"
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
					placeholder="90"
				/>
			</div>
		{/if}

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Base price (€) *</label>
			<input
				name="basePrice"
				type="number"
				step="0.01"
				min="0"
				required
				value={form?.values?.basePrice ?? ''}
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="40.00"
			/>
		</div>

		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea
				name="description"
				rows="3"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder="Optional description…"
			>{form?.values?.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Service'}
		</button>
	</form>
</div>
