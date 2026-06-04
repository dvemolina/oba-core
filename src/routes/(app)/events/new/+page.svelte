<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/events" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">{m.event_new_title()}</h1>
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
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.event_new_title_label()}</label>
			<input
				name="title"
				required
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				placeholder={m.event_new_title_placeholder()}
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">{m.event_new_start_date()}</label>
				<input
					name="startDate"
					type="date"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">{m.event_new_end_date()}</label>
				<input
					name="endDate"
					type="date"
					required
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.event_new_price()}</label>
			<input
				name="price"
				type="number"
				step="0.01"
				min="0"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			/>
		</div>
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">{m.common_description()}</label>
			<textarea
				name="description"
				rows="2"
				class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			></textarea>
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
			class="w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white disabled:opacity-60"
		>
			{loading ? m.common_saving() : m.event_new_submit()}
		</button>
	</form>
</div>
