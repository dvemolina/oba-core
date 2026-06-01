<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	// ── Template definitions ──────────────────────────────────────────────────
	const TEMPLATES = [
		{
			id: 'lesson',
			label: 'Lesson',
			description: 'Individual or group session with instructor (surf lesson, ski class, yoga, guided tour…)',
			flags: { hasSessions: true, hasRoster: false, hasDateRange: false, hasInventoryUnits: false, requiresInstructor: true }
		},
		{
			id: 'camp',
			label: 'Camp / Course',
			description: 'Multi-day programme with a roster of enrolled participants',
			flags: { hasSessions: true, hasRoster: true, hasDateRange: true, hasInventoryUnits: false, requiresInstructor: true }
		},
		{
			id: 'rental',
			label: 'Rental',
			description: 'Physical equipment rented for a period (boards, skis, bikes, kayaks…)',
			flags: { hasSessions: false, hasRoster: false, hasDateRange: true, hasInventoryUnits: true, requiresInstructor: false }
		},
		{
			id: 'accommodation',
			label: 'Accommodation',
			description: 'Rooms, beds, or whole-property stays',
			flags: { hasSessions: false, hasRoster: false, hasDateRange: true, hasInventoryUnits: true, requiresInstructor: false }
		},
		{
			id: 'product',
			label: 'Product / Service',
			description: 'Simple purchase — gear, merchandise, one-off service fee',
			flags: { hasSessions: false, hasRoster: false, hasDateRange: false, hasInventoryUnits: false, requiresInstructor: false }
		},
		{
			id: 'other',
			label: 'Other',
			description: 'Configure capabilities manually for any service type',
			flags: { hasSessions: false, hasRoster: false, hasDateRange: false, hasInventoryUnits: false, requiresInstructor: true }
		},
	] as const;

	type TemplateId = typeof TEMPLATES[number]['id'];

	let selectedTemplateId = $state<TemplateId>('lesson');

	const template = $derived(TEMPLATES.find(t => t.id === selectedTemplateId)!);

	// Capability flags — start from template, user can tweak in Advanced
	let hasSessions       = $state(true);
	let hasRoster         = $state(false);
	let hasDateRange      = $state(false);
	let hasInventoryUnits = $state(false);
	let requiresInstructor = $state(true);

	// When template changes, reset flags
	$effect(() => {
		const f = template.flags;
		hasSessions       = f.hasSessions;
		hasRoster         = f.hasRoster;
		hasDateRange      = f.hasDateRange;
		hasInventoryUnits = f.hasInventoryUnits;
		requiresInstructor = f.requiresInstructor;
	});

	let showAdvanced = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-semibold text-navy">New Service</h1>
	</div>

	<form method="post" class="space-y-5"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<!-- Hidden capability flags -->
		<input type="hidden" name="hasSessions"       value={String(hasSessions)} />
		<input type="hidden" name="hasRoster"         value={String(hasRoster)} />
		<input type="hidden" name="hasDateRange"      value={String(hasDateRange)} />
		<input type="hidden" name="hasInventoryUnits" value={String(hasInventoryUnits)} />
		<input type="hidden" name="requiresInstructor" value={String(requiresInstructor)} />
		<input type="hidden" name="type"              value={selectedTemplateId} />

		<!-- Step 1: Template selection -->
		<div>
			<label class="label mb-2">Type</label>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{#each TEMPLATES as t}
					<button
						type="button"
						onclick={() => selectedTemplateId = t.id}
						class="flex flex-col items-start rounded-xl border p-3 text-left transition-all
							{selectedTemplateId === t.id
								? 'border-ocean bg-ocean/5 ring-2 ring-ocean/30'
								: 'border-border bg-surface hover:border-ocean/40 hover:bg-sand'}"
					>
						<span class="text-sm font-semibold text-navy">{t.label}</span>
						<span class="mt-0.5 text-[11px] leading-snug text-muted">{t.description}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Step 2: Core fields -->
		<div>
			<label class="label">Name *</label>
			<input name="name" required value={form?.values?.name ?? ''}
				class="input" placeholder="e.g. Beginner Surf Lesson" />
		</div>

		<div>
			<label class="label">Base price (€) *</label>
			<input name="basePrice" type="number" step="0.01" min="0" required
				value={form?.values?.basePrice ?? ''}
				class="input" placeholder="40.00" />
		</div>

		{#if hasSessions && !hasRoster}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label">Session duration (min)</label>
					<input name="durationMinutes" type="number" min="15" step="15"
						class="input" placeholder="90" />
				</div>
				<div>
					<label class="label">Sessions / booking</label>
					<input name="defaultSessionsIncluded" type="number" min="1" step="1"
						class="input" placeholder="1" />
					<p class="mt-1 text-xs text-muted">Default when creating a booking</p>
				</div>
			</div>
		{/if}

		{#if hasDateRange}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label">Start date {hasRoster ? '*' : ''}</label>
					<input name="startDate" type="date" required={hasRoster} class="input" />
				</div>
				<div>
					<label class="label">End date {hasRoster ? '*' : ''}</label>
					<input name="endDate" type="date" required={hasRoster} class="input" />
				</div>
			</div>
		{/if}

		{#if hasRoster}
			<div>
				<label class="label">Max participants *</label>
				<input name="maxCapacity" type="number" min="1" step="1" required
					class="input" placeholder="12" />
			</div>
		{:else if hasInventoryUnits}
			<div>
				<label class="label">Available units *</label>
				<input name="maxCapacity" type="number" min="1" step="1" required
					class="input" placeholder="e.g. 8 boards, 4 rooms" />
			</div>
		{/if}

		{#if requiresInstructor && data.instructors.length > 0}
			<div>
				<label class="label mb-2">Default instructor{hasRoster ? 's' : ''}</label>
				<div class="space-y-2 rounded-lg border border-border p-3">
					{#each data.instructors as instructor}
						<label class="flex cursor-pointer items-center gap-3">
							<input type="checkbox" name="defaultInstructorId" value={instructor.id}
								class="h-4 w-4 accent-ocean" />
							<span class="text-sm text-gray-800">{instructor.name}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<div>
			<label class="label mb-2">Color</label>
			<ColorPicker selected={form?.values?.color ?? 'ocean'} />
		</div>

		<div>
			<label class="label">Description</label>
			<textarea name="description" rows="2" class="input"
				placeholder="Optional details…">{form?.values?.description ?? ''}</textarea>
		</div>

		<!-- Advanced: capability flags -->
		<details bind:open={showAdvanced} class="rounded-lg border border-border">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-muted hover:text-slate-700">
				Advanced — capability flags
			</summary>
			<div class="space-y-2 border-t border-border px-4 py-3">
				{#each [
					{ key: 'hasSessions',       label: 'Has sessions',         desc: 'Needs scheduled occurrences (lessons, classes, guided tours)', bind: hasSessions },
					{ key: 'hasRoster',         label: 'Has roster',           desc: 'Multiple clients enrolled together', bind: hasRoster },
					{ key: 'hasDateRange',      label: 'Has date range',       desc: 'Spans multiple days (camps, stays, multi-day packages)', bind: hasDateRange },
					{ key: 'hasInventoryUnits', label: 'Has inventory units',  desc: 'Limited physical units to allocate (rooms, gear)', bind: hasInventoryUnits },
					{ key: 'requiresInstructor', label: 'Requires instructor', desc: 'Needs a guide or instructor assigned', bind: requiresInstructor },
				] as flag}
					<label class="flex cursor-pointer items-start gap-3">
						<input type="checkbox"
							checked={flag.key === 'hasSessions' ? hasSessions
							       : flag.key === 'hasRoster' ? hasRoster
							       : flag.key === 'hasDateRange' ? hasDateRange
							       : flag.key === 'hasInventoryUnits' ? hasInventoryUnits
							       : requiresInstructor}
							onchange={(e) => {
								const v = (e.target as HTMLInputElement).checked;
								if (flag.key === 'hasSessions') hasSessions = v;
								else if (flag.key === 'hasRoster') hasRoster = v;
								else if (flag.key === 'hasDateRange') hasDateRange = v;
								else if (flag.key === 'hasInventoryUnits') hasInventoryUnits = v;
								else requiresInstructor = v;
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

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary btn-block">
			{loading ? 'Saving…' : 'Create Service'}
		</button>
	</form>
</div>
