<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedType = $state('lesson');
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-semibold text-navy">New Service</h1>
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
			<label class="label">Name *</label>
			<input
				name="name"
				required
				value={form?.values?.name ?? ''}
				class="input"
				placeholder="Group Surf Lesson"
			/>
		</div>

		<div>
			<label class="label">Type *</label>
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

		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700">Color</label>
			<ColorPicker selected={form?.values?.color ?? 'ocean'} />
		</div>

		{#if selectedType === 'lesson'}
			<div>
				<label class="label">Duration (minutes)</label>
				<input
					name="durationMinutes"
					type="number"
					min="15"
					step="15"
					class="input"
					placeholder="90"
				/>
			</div>
		{/if}

		{#if selectedType === 'camp'}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label">Start date *</label>
					<input
						name="campStartDate"
						type="date"
						required
						class="input"
					/>
				</div>
				<div>
					<label class="label">End date *</label>
					<input
						name="campEndDate"
						type="date"
						required
						class="input"
					/>
				</div>
			</div>
			<div>
				<label class="label">Max students *</label>
				<input
					name="maxStudents"
					type="number"
					min="1"
					step="1"
					required
					class="input"
					placeholder="10"
				/>
			</div>
			{#if data.instructors.length > 0}
				<div>
					<label class="mb-2 block text-sm font-medium text-gray-700">Instructors</label>
					<div class="space-y-2 rounded-lg border border-border p-3">
						{#each data.instructors as instructor}
							<label class="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									name="campInstructorId"
									value={instructor.id}
									class="h-4 w-4 accent-ocean"
								/>
								<span class="text-sm text-gray-800">{instructor.name}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<div>
			<label class="label">Base price (€) *</label>
			<input
				name="basePrice"
				type="number"
				step="0.01"
				min="0"
				required
				value={form?.values?.basePrice ?? ''}
				class="input"
				placeholder="40.00"
			/>
		</div>

		<div>
			<label class="label">Description</label>
			<textarea
				name="description"
				rows="3"
				class="input"
				placeholder="Optional description…"
			>{form?.values?.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary btn-block">
			{loading ? 'Saving…' : 'Save Service'}
		</button>
	</form>
</div>
