<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// ── RBAC ─────────────────────────────────────────────────────────────────
	const canEditServices = $derived(data.canEditServices);

	let editing = $state(false);
	let loading = $state(false);

	// Edit-mode capability flags (initialised from service, user can modify)
	let editHasSessions       = $state(data.service.hasSessions);
	let editHasRoster         = $state(data.service.hasRoster);
	let editHasDateRange      = $state(data.service.hasDateRange);
	let editHasInventoryUnits = $state(data.service.hasInventoryUnits);
	let editRequiresInstructor = $state(data.service.requiresInstructor);

	// Inventory unit management state
	let showAddUnitType = $state(false);
	let addingUnitToTypeId = $state<string | null>(null);
	const OCCUPANCY_LABELS: Record<string, string> = {
		shared: 'Shared (beds)',
		private: 'Private room',
		entire: 'Entire property'
	};

	const TEMPLATE_LABELS: Record<string, string> = {
		lesson: 'Lesson', camp: 'Camp / Course', product: 'Product',
		rental: 'Rental', accommodation: 'Accommodation', other: 'Other'
	};
	const LABEL_OPTIONS = ['lesson', 'camp', 'rental', 'accommodation', 'product', 'other'] as const;

	// Capability badge labels for view mode
	const capabilityBadges = $derived([
		data.service.hasSessions       && 'Sessions',
		data.service.hasRoster         && 'Roster',
		data.service.hasDateRange      && 'Date range',
		data.service.hasInventoryUnits && 'Inventory units',
		data.service.requiresInstructor && 'Instructor',
	].filter(Boolean) as string[]);

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
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<div class="flex-1">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">{TEMPLATE_LABELS[data.service.type] ?? data.service.type}</p>
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
			{#if canEditServices}
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted">Price</span>
				<span class="text-sm font-semibold text-gray-800">€{data.service.basePrice}</span>
			</div>
			{:else}
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted">Price</span>
				<span class="text-sm text-muted">Pricing managed by owners</span>
			</div>
			{/if}
			{#if data.service.durationMinutes}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Duration</span>
					<span class="text-sm text-gray-800">{data.service.durationMinutes} min</span>
				</div>
			{/if}
			{#if data.service.startDate}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Dates</span>
					<span class="text-sm text-gray-800">{data.service.startDate} → {data.service.endDate}</span>
				</div>
			{/if}
			{#if data.service.maxCapacity}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Max capacity</span>
					<span class="text-sm text-gray-800">{data.service.maxCapacity}</span>
				</div>
			{/if}
			{#if capabilityBadges.length > 0}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Capabilities</span>
					<div class="mt-1.5 flex flex-wrap gap-1">
						{#each capabilityBadges as badge}
							<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if data.service.defaultInstructorIds?.length}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">Instructors</span>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each data.instructors.filter(i => data.service.defaultInstructorIds?.includes(i.id)) as instructor}
							<span class="rounded-full bg-ocean/10 px-2.5 py-0.5 text-xs font-medium text-ocean">{instructor.name}</span>
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

		<!-- Accommodation unit management -->
		{#if data.service.hasInventoryUnits}
			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-xs font-semibold uppercase tracking-wider text-muted">Unit Types & Inventory</h2>
					{#if canEditServices}
					<button type="button" onclick={() => (showAddUnitType = !showAddUnitType)}
						class="text-xs font-medium text-ocean hover:underline">
						{showAddUnitType ? 'Cancel' : '+ Add type'}
					</button>
					{/if}
				</div>

				{#if canEditServices && showAddUnitType}
					<form method="post" action="?/addUnitType" use:enhance={serviceEnhance()} class="mb-3 space-y-2 rounded-lg border border-ocean/30 bg-ocean/5 p-3">
						<p class="text-xs font-semibold text-ocean">New unit type</p>
						<input name="utName" required placeholder="e.g. Dorm Bed, Double Room"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<div class="grid grid-cols-2 gap-2">
							<select name="occupancyType" class="rounded-md border border-border bg-white px-2.5 py-2 text-sm focus:border-ocean focus:outline-none">
								<option value="shared">Shared (beds)</option>
								<option value="private">Private room</option>
								<option value="entire">Entire property</option>
							</select>
							<input name="maxOccupancy" type="number" min="1" required placeholder="Max guests"
								class="rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						</div>
						<input name="pricePerNight" type="number" step="0.01" min="0" required placeholder="Price / night (€)"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<button type="submit" class="w-full rounded-md bg-ocean py-2 text-xs font-semibold text-white hover:bg-ocean/90">Add unit type</button>
					</form>
				{/if}

				{#if data.unitTypes.length === 0 && !showAddUnitType}
					<p class="py-4 text-center text-xs text-muted">No unit types yet. Add one above.</p>
				{/if}

				<div class="space-y-3">
					{#each data.unitTypes as ut}
						<div class="rounded-lg border border-border bg-surface">
							<!-- Unit type header -->
							<div class="flex items-center justify-between px-3 py-2.5">
								<div>
									<p class="text-sm font-semibold text-gray-800">{ut.name}</p>
									<p class="text-xs text-muted">
										{OCCUPANCY_LABELS[ut.occupancyType] ?? ut.occupancyType} · max {ut.maxOccupancy} guests
										{#if canEditServices} · €{ut.pricePerNight}/night{/if}
									</p>
								</div>
								{#if canEditServices}
								<form method="post" action="?/deleteUnitType" use:enhance={serviceEnhance()}
									onsubmit={(e) => { if (!confirm(`Delete "${ut.name}" and all its units?`)) e.preventDefault(); }}>
									<input type="hidden" name="unitTypeId" value={ut.id} />
									<button type="submit" class="text-xs text-flexible hover:underline">Delete</button>
								</form>
								{/if}
							</div>

							<!-- Physical units list -->
							<div class="border-t border-border/50 px-3 py-2">
								{#if ut.units.length === 0}
									<p class="text-xs text-muted italic">No physical units yet.</p>
								{/if}
								<div class="flex flex-wrap gap-1.5">
									{#each ut.units as unit}
										<div class="flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 ring-1 ring-border">
											<span class="text-xs text-gray-700">{unit.name}</span>
											{#if canEditServices}
											<form method="post" action="?/deleteUnit" use:enhance={serviceEnhance()}>
												<input type="hidden" name="unitId" value={unit.id} />
												<button type="submit" class="ml-0.5 text-[10px] text-muted hover:text-flexible">✕</button>
											</form>
											{/if}
										</div>
									{/each}
									{#if canEditServices}
										{#if addingUnitToTypeId === ut.id}
											<form method="post" action="?/addUnit" use:enhance={serviceEnhance()}
												onsubmit={() => (addingUnitToTypeId = null)}
												class="flex items-center gap-1">
												<input type="hidden" name="unitTypeId" value={ut.id} />
												<input name="unitName" required autofocus placeholder="Unit name"
													class="w-28 rounded-full border border-ocean px-2.5 py-0.5 text-xs focus:outline-none" />
												<button type="submit" class="text-xs font-medium text-ocean">Add</button>
												<button type="button" onclick={() => (addingUnitToTypeId = null)} class="text-xs text-muted">✕</button>
											</form>
										{:else}
											<button type="button" onclick={() => (addingUnitToTypeId = ut.id)}
												class="rounded-full border border-dashed border-ocean/40 px-2.5 py-0.5 text-xs text-ocean hover:border-ocean">
												+ Add unit
											</button>
										{/if}
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Global error (e.g. delete blocked) -->
		{#if form?.error && !editing}
			<p class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<!-- Actions -->
		<div class="flex flex-col gap-2">
			{#if data.service.hasRoster && data.service.startDate}
				<a href="/bookings/camp/{data.service.id}" class="btn-primary btn-block text-center">
					Open Camp Roster
				</a>
			{/if}
			{#if canEditServices}
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => {
					editHasSessions = data.service.hasSessions;
					editHasRoster = data.service.hasRoster;
					editHasDateRange = data.service.hasDateRange;
					editHasInventoryUnits = data.service.hasInventoryUnits;
					editRequiresInstructor = data.service.requiresInstructor;
					editing = true;
				}}
					class="btn-secondary flex-1"
				>Edit</button>
				<form method="post" action="?/toggle" use:enhance={serviceEnhance()}>
					<button type="submit" class="{data.service.active ? 'btn-ghost' : 'btn-ghost text-confirmed'}">
						{data.service.active ? 'Deactivate' : 'Activate'}
					</button>
				</form>
				<form method="post" action="?/delete" use:enhance={serviceEnhance()}
					onsubmit={(e) => { if (!confirm('Delete this service permanently?')) e.preventDefault(); }}>
					<button type="submit" class="btn-destructive">Delete</button>
				</form>
			</div>
			{/if}
		</div>

	{:else}
	<!-- ── EDIT MODE ─────────────────────────────────────────────── -->

		<form
			method="post"
			action="?/update"
			class="space-y-4"
			use:enhance={serviceEnhance()}
		>
			<!-- Hidden capability flags (kept in sync with toggle UI below) -->
			<input type="hidden" name="hasSessions"        value={String(editHasSessions)} />
			<input type="hidden" name="hasRoster"          value={String(editHasRoster)} />
			<input type="hidden" name="hasDateRange"       value={String(editHasDateRange)} />
			<input type="hidden" name="hasInventoryUnits"  value={String(editHasInventoryUnits)} />
			<input type="hidden" name="requiresInstructor" value={String(editRequiresInstructor)} />

			<div>
				<label class="label">Name *</label>
				<input name="name" required value={data.service.name} class="input" />
			</div>

			<div>
				<label class="label">Label / category</label>
				<select name="type" class="input">
					{#each LABEL_OPTIONS as opt}
						<option value={opt} selected={data.service.type === opt}>
							{TEMPLATE_LABELS[opt] ?? opt}
						</option>
					{/each}
					{#if !LABEL_OPTIONS.includes(data.service.type as any)}
						<option value={data.service.type} selected>{data.service.type}</option>
					{/if}
				</select>
				<p class="mt-1 text-xs text-muted">Display label only — doesn't affect behaviour</p>
			</div>

			<div>
				<label class="label">Color</label>
				<ColorPicker selected={data.service.color} />
			</div>

			<!-- Capability flags (same as new-service Advanced section) -->
			<details class="rounded-lg border border-border">
				<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-muted hover:text-slate-700">
					Capability flags
				</summary>
				<div class="space-y-2 border-t border-border px-4 py-3">
					{#each [
						{ key: 'hasSessions',        label: 'Has sessions',        desc: 'Needs scheduled occurrences (lessons, classes, guided tours)', value: editHasSessions },
						{ key: 'hasRoster',          label: 'Has roster',          desc: 'Multiple clients enrolled together', value: editHasRoster },
						{ key: 'hasDateRange',       label: 'Has date range',      desc: 'Spans multiple days (camps, stays, multi-day packages)', value: editHasDateRange },
						{ key: 'hasInventoryUnits',  label: 'Has inventory units', desc: 'Limited physical units to allocate (rooms, gear)', value: editHasInventoryUnits },
						{ key: 'requiresInstructor', label: 'Requires instructor', desc: 'Needs a guide or instructor assigned', value: editRequiresInstructor },
					] as flag}
						<label class="flex cursor-pointer items-start gap-3">
							<input type="checkbox"
								checked={flag.value}
								onchange={(e) => {
									const v = (e.target as HTMLInputElement).checked;
									if (flag.key === 'hasSessions') editHasSessions = v;
									else if (flag.key === 'hasRoster') editHasRoster = v;
									else if (flag.key === 'hasDateRange') editHasDateRange = v;
									else if (flag.key === 'hasInventoryUnits') editHasInventoryUnits = v;
									else editRequiresInstructor = v;
								}}
								class="mt-0.5 h-4 w-4 accent-ocean" />
							<div>
								<p class="text-sm font-medium text-gray-800">{flag.label}</p>
								<p class="text-xs text-muted">{flag.desc}</p>
							</div>
						</label>
					{/each}
				</div>
			</details>

			{#if editHasSessions && !editHasRoster}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label">Session duration (min)</label>
						<input name="durationMinutes" type="number" min="15" step="15"
							value={data.service.durationMinutes ?? ''} class="input" />
					</div>
					<div>
						<label class="label">Sessions / booking</label>
						<input name="defaultSessionsIncluded" type="number" min="1" step="1"
							value={data.service.defaultSessionsIncluded ?? ''} class="input" placeholder="1" />
						<p class="mt-1 text-xs text-muted">Default when creating a booking</p>
					</div>
				</div>
			{/if}

			{#if editHasDateRange}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label">Start date {editHasRoster ? '*' : ''}</label>
						<input name="startDate" type="date" required={editHasRoster} value={data.service.startDate ?? ''} class="input" />
					</div>
					<div>
						<label class="label">End date {editHasRoster ? '*' : ''}</label>
						<input name="endDate" type="date" required={editHasRoster} value={data.service.endDate ?? ''} class="input" />
					</div>
				</div>
			{/if}

			{#if editHasRoster}
				<div>
					<label class="label">Max participants *</label>
					<input name="maxCapacity" type="number" min="1" step="1" required
						value={data.service.maxCapacity ?? ''} class="input" />
				</div>
			{:else if editHasInventoryUnits}
				<div>
					<label class="label">Available units *</label>
					<input name="maxCapacity" type="number" min="1" step="1" required
						value={data.service.maxCapacity ?? ''} class="input" />
				</div>
			{/if}

			{#if editRequiresInstructor && data.instructors.length > 0}
				<div>
					<label class="label mb-2">Default instructor{editHasRoster ? 's' : ''}</label>
					<div class="space-y-2 rounded-lg border border-border p-3">
						{#each data.instructors as instructor}
							<label class="flex cursor-pointer items-center gap-3">
								<input type="checkbox" name="defaultInstructorId" value={instructor.id}
									checked={data.service.defaultInstructorIds?.includes(instructor.id) ?? false}
									class="h-4 w-4 accent-ocean" />
								<span class="text-sm text-gray-800">{instructor.name}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			{#if canEditServices}
			<div>
				<label class="label">Base price (€) *</label>
				<input name="basePrice" type="number" step="0.01" min="0" required value={data.service.basePrice}
					class="input" />
			</div>
			{:else}
			<div>
				<label class="label">Base price (€)</label>
				<p class="text-sm text-muted">Pricing managed by owners</p>
				<input type="hidden" name="basePrice" value={data.service.basePrice} />
			</div>
			{/if}

			<div>
				<label class="label">Description</label>
				<textarea name="description" rows="3"
					class="input"
				>{data.service.description ?? ''}</textarea>
			</div>

			{#if form?.error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
			{/if}

			{#if canEditServices}
			<div class="flex gap-2">
				<button type="submit" disabled={loading} class="btn-primary flex-1">
					{loading ? 'Saving…' : 'Save Changes'}
				</button>
				<button type="button" onclick={() => editing = false} class="btn-secondary">
					Cancel
				</button>
			</div>
			{:else}
			<div class="flex gap-2">
				<button type="button" onclick={() => editing = false} class="btn-secondary flex-1">
					Cancel
				</button>
			</div>
			{/if}
		</form>
	{/if}
</div>
