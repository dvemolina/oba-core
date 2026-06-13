<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { PRICING_MODE_OPTIONS, defaultPricingMode } from '$lib/utils/pricing';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	import type { ServiceModules } from '$lib/utils/pricing';

	// ── Template definitions ──────────────────────────────────────────────────
	const TEMPLATES = $derived([
		{
			id: 'lesson',
			label: m.service_new_type_lesson(),
			description: m.service_new_type_lesson_desc(),
			modules: { sessions: {}, instructor: { required: true } } satisfies ServiceModules
		},
		{
			id: 'camp',
			label: m.service_new_type_camp(),
			description: m.service_new_type_camp_desc(),
			modules: { sessions: {}, roster: { maxCapacity: 0 }, editions: {}, instructor: { required: true } } satisfies ServiceModules
		},
		{
			id: 'rental',
			label: m.service_new_type_rental(),
			description: m.service_new_type_rental_desc(),
			modules: { editions: {}, inventory: { perParticipant: true } } satisfies ServiceModules
		},
		{
			id: 'accommodation',
			label: m.service_new_type_accommodation(),
			description: m.service_new_type_accommodation_desc(),
			modules: { editions: {}, inventory: { perParticipant: true } } satisfies ServiceModules
		},
		{
			id: 'product',
			label: m.service_new_type_product(),
			description: m.service_new_type_product_desc(),
			modules: {} satisfies ServiceModules
		},
		{
			id: 'other',
			label: m.service_new_type_other(),
			description: m.service_new_type_other_desc(),
			modules: { instructor: { required: true } } satisfies ServiceModules
		},
	]);

	type TemplateId = 'lesson' | 'camp' | 'rental' | 'accommodation' | 'product' | 'other';

	let selectedTemplateId = $state<TemplateId>('lesson');

	const template = $derived(TEMPLATES.find(t => t.id === selectedTemplateId)!);

	// Active modules — start from template, user can tweak in Advanced
	let modules = $state<ServiceModules>({ sessions: {}, instructor: { required: true } });

	// When template changes, reset modules
	$effect(() => {
		modules = { ...template.modules };
	});

	// Smart default pricingMode derived from current modules
	const smartPricingMode = $derived(defaultPricingMode(modules));

	let showAdvanced = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-semibold text-navy">{m.service_new_title()}</h1>
	</div>

	<form method="post" class="space-y-5"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<!-- Hidden modules JSON -->
		<input type="hidden" name="modules" value={JSON.stringify(modules)} />
		<input type="hidden" name="type"    value={selectedTemplateId} />

		<!-- Step 1: Template selection -->
		<div>
			<label class="label mb-2">{m.service_new_type_label()}</label>
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
			<label class="label">{m.service_new_name()}</label>
			<input name="name" required value={form?.values?.name ?? ''}
				class="input" placeholder={m.service_new_name_placeholder()} />
		</div>

		<div>
			<label class="label">{m.service_new_base_price()}</label>
			<input name="basePrice" type="number" step="0.01" min="0" required
				value={form?.values?.basePrice ?? ''}
				class="input" placeholder="40.00" />
		</div>

		{#if modules.sessions && !modules.roster}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label">{m.service_new_duration()}</label>
					<input name="durationMinutes" type="number" min="15" step="15"
						class="input" placeholder="90" />
				</div>
				<div>
					<label class="label">{m.service_new_sessions_per_booking()}</label>
					<input name="defaultSessionsIncluded" type="number" min="1" step="1"
						class="input" placeholder="1" />
					<p class="mt-1 text-xs text-muted">{m.service_new_sessions_default_hint()}</p>
				</div>
			</div>
		{/if}

		{#if modules.editions}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label">Start date {modules.roster ? '*' : ''}</label>
					<input name="startDate" type="date" required={!!modules.roster} class="input" />
				</div>
				<div>
					<label class="label">End date {modules.roster ? '*' : ''}</label>
					<input name="endDate" type="date" required={!!modules.roster} class="input" />
				</div>
			</div>
		{/if}

		{#if modules.roster}
			<div>
				<label class="label">{m.service_new_max_participants()}</label>
				<input name="maxCapacity" type="number" min="1" step="1" required
					class="input" placeholder="12" />
			</div>
		{:else if modules.inventory}
			<div>
				<label class="label">{m.service_new_available_units()}</label>
				<input name="maxCapacity" type="number" min="1" step="1" required
					class="input" placeholder={m.service_new_available_units_placeholder()} />
			</div>
		{/if}

		<!-- Pricing mode — all service types -->
		<div>
			<label class="label">Pricing mode</label>
			<select name="pricingMode" class="input">
				<option value="">— none (manual) —</option>
				{#each PRICING_MODE_OPTIONS as opt}
					<option value={opt.value} selected={smartPricingMode === opt.value}>
						{opt.label} — {opt.hint}
					</option>
				{/each}
			</select>
			<p class="mt-1 text-xs text-muted">Auto-selected based on service type. Determines how booking price is calculated.</p>
		</div>

		{#if modules.instructor?.required && data.instructors.length > 0}
			<div>
				<label class="label mb-2">{m.service_new_default_instructors()}</label>
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
			<label class="label mb-2">{m.service_new_color()}</label>
			<ColorPicker selected={form?.values?.color ?? 'ocean'} />
		</div>

		<div>
			<label class="label">{m.common_description()}</label>
			<textarea name="description" rows="2" class="input"
				placeholder={m.service_new_description_placeholder()}>{form?.values?.description ?? ''}</textarea>
		</div>

		<!-- Advanced: capability flags -->
		<details bind:open={showAdvanced} class="rounded-lg border border-border">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-muted hover:text-slate-700">
				{m.service_new_advanced()}
			</summary>
			<div class="space-y-2 border-t border-border px-4 py-3">
				{#each [
					{ key: 'sessions',    label: m.service_new_flag_has_sessions(),        desc: m.service_new_flag_has_sessions_desc() },
					{ key: 'roster',      label: m.service_new_flag_has_roster(),           desc: m.service_new_flag_has_roster_desc() },
					{ key: 'editions',    label: m.service_new_flag_has_date_range(),       desc: m.service_new_flag_has_date_range_desc() },
					{ key: 'inventory',   label: m.service_new_flag_has_inventory(),        desc: m.service_new_flag_has_inventory_desc() },
					{ key: 'instructor',  label: m.service_new_flag_requires_instructor(), desc: m.service_new_flag_requires_instructor_desc() },
				] as flag}
					<label class="flex cursor-pointer items-start gap-3">
						<input type="checkbox"
							checked={flag.key === 'instructor' ? !!modules.instructor?.required : flag.key in modules}
							onchange={(e) => {
								const v = (e.target as HTMLInputElement).checked;
								if (flag.key === 'sessions') {
									if (v) modules = { ...modules, sessions: {} };
									else { const { sessions: _, ...rest } = modules; modules = rest; }
								} else if (flag.key === 'roster') {
									if (v) modules = { ...modules, roster: { maxCapacity: 0 } };
									else { const { roster: _, ...rest } = modules; modules = rest; }
								} else if (flag.key === 'editions') {
									if (v) modules = { ...modules, editions: {} };
									else { const { editions: _, ...rest } = modules; modules = rest; }
								} else if (flag.key === 'inventory') {
									if (v) modules = { ...modules, inventory: { perParticipant: true } };
									else { const { inventory: _, ...rest } = modules; modules = rest; }
								} else {
									modules = { ...modules, instructor: { required: v } };
								}
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
			{loading ? m.common_saving() : m.service_new_submit()}
		</button>
	</form>
</div>
