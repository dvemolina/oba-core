<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);
	let selectedType = $state(data.service.type);
	let loading = $state(false);

	const typeLabels: Record<string, string> = {
		lesson: 'Lesson', camp: 'Camp', product: 'Product', rental: 'Rental', accommodation: 'Accommodation'
	};

	function serviceEnhance() {
		return () => async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				if (result.data?.message) toast(result.data.message);
				if (result.data?.deleted) { await goto('/services'); return; }
				editing = false;
				await update();
			} else {
				await update();
			}
		};
	}
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="text-muted hover:text-gray-700">←</a>
		<div class="flex-1">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">{typeLabels[data.service.type] ?? data.service.type}</p>
			<div class="flex items-center gap-2">
				<span class="inline-block h-3 w-3 rounded-full" style="background-color: {DOT_COLORS[data.service.color as ServiceColorKey] ?? DOT_COLORS['ocean']}"></span>
				<h1 class="text-xl font-bold text-navy">{data.service.name}</h1>
			</div>
		</div>
		{#if !data.service.active}
			<span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-muted">inactive</span>
		{/if}
	</div>

	{#if !editing}
	<!-- ── VIEW MODE ─────────────────────────────────────────────── -->

		<div class="mb-4 space-y-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted">Price</span>
				<span class="text-sm font-semibold text-gray-800">€{data.service.basePrice}</span>
			</div>
			{#if data.service.durationMinutes}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Duration</span>
					<span class="text-sm text-gray-800">{data.service.durationMinutes} min</span>
				</div>
			{/if}
			{#if data.service.campStartDate}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Dates</span>
					<span class="text-sm text-gray-800">{data.service.campStartDate} → {data.service.campEndDate}</span>
				</div>
			{/if}
			{#if data.service.maxStudents}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Max students</span>
					<span class="text-sm text-gray-800">{data.service.maxStudents}</span>
				</div>
			{/if}
			{#if data.service.campInstructorIds?.length}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Instructors</span>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each data.instructors.filter(i => data.service.campInstructorIds?.includes(i.id)) as instructor}
							<span class="rounded-full bg-ocean/10 px-2.5 py-0.5 text-xs font-medium text-ocean">🌊 {instructor.name}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if data.service.description}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Description</span>
					<p class="mt-1 text-sm text-gray-700">{data.service.description}</p>
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-2">
			{#if data.service.type === 'camp' && data.service.campStartDate}
				<a
					href="/bookings/camp/{data.service.id}"
					class="w-full rounded-lg bg-ocean py-2.5 text-center text-sm font-semibold text-white hover:bg-ocean/90"
				>🏕️ Open Camp Roster</a>
			{/if}
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => { selectedType = data.service.type; editing = true; }}
					class="flex-1 rounded-lg py-2.5 text-sm font-semibold ring-1 ring-border text-gray-700 hover:bg-sand"
				>Edit</button>
				<form method="post" action="?/toggle" use:enhance={serviceEnhance()}>
					<button type="submit"
						class="rounded-lg px-4 py-2.5 text-sm font-medium ring-1 {data.service.active
							? 'ring-border text-muted hover:text-gray-700'
							: 'ring-confirmed text-confirmed'}"
					>{data.service.active ? 'Deactivate' : 'Activate'}</button>
				</form>
				<form method="post" action="?/delete" use:enhance={serviceEnhance()}
					onsubmit={(e) => { if (!confirm('Delete this service permanently?')) e.preventDefault(); }}>
					<button type="submit"
						class="rounded-lg px-4 py-2.5 text-sm font-medium text-flexible ring-1 ring-flexible hover:bg-flexible/5"
					>Delete</button>
				</form>
			</div>
		</div>

	{:else}
	<!-- ── EDIT MODE ─────────────────────────────────────────────── -->

		<form
			method="post"
			action="?/update"
			class="space-y-4"
			use:enhance={serviceEnhance()}
		>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
				<input name="name" required value={data.service.name}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Type *</label>
				<select name="type" bind:value={selectedType}
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">
					{#each ['lesson', 'camp', 'product', 'rental'] as t}
						<option value={t} selected={data.service.type === t}>{t}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Color</label>
				<ColorPicker selected={data.service.color} />
			</div>

			{#if selectedType === 'lesson'}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Duration (minutes)</label>
					<input name="durationMinutes" type="number" min="15" step="15" value={data.service.durationMinutes ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
				</div>
			{/if}

			{#if selectedType === 'camp'}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Start date *</label>
						<input name="campStartDate" type="date" required value={data.service.campStartDate ?? ''}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">End date *</label>
						<input name="campEndDate" type="date" required value={data.service.campEndDate ?? ''}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
					</div>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Max students *</label>
					<input name="maxStudents" type="number" min="1" step="1" required value={data.service.maxStudents ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
				</div>
				{#if data.instructors.length > 0}
					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700">Instructors</label>
						<div class="space-y-2 rounded-lg border border-border p-3">
							{#each data.instructors as instructor}
								<label class="flex cursor-pointer items-center gap-3">
									<input type="checkbox" name="campInstructorId" value={instructor.id}
										checked={data.service.campInstructorIds?.includes(instructor.id) ?? false}
										class="h-4 w-4 accent-ocean" />
									<span class="text-sm text-gray-800">{instructor.name}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Base price (€) *</label>
				<input name="basePrice" type="number" step="0.01" min="0" required value={data.service.basePrice}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
				<textarea name="description" rows="3"
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				>{data.service.description ?? ''}</textarea>
			</div>

			{#if form?.error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
			{/if}

			<div class="flex gap-2">
				<button type="submit" disabled={loading}
					class="flex-1 rounded-lg bg-ocean py-2.5 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60">
					{loading ? 'Saving…' : 'Save Changes'}
				</button>
				<button type="button" onclick={() => editing = false}
					class="rounded-lg px-4 py-2.5 text-sm text-muted ring-1 ring-border hover:text-gray-700">
					Cancel
				</button>
			</div>
		</form>
	{/if}
</div>
