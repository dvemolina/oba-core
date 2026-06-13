<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { PRICING_MODE_OPTIONS, defaultPricingMode } from '$lib/utils/pricing';
	import { MODULE_DEFINITIONS } from '$lib/modules/index';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	import type { ServiceModules } from '$lib/utils/pricing';

	function getDefaultConfig(key: string): Record<string, unknown> {
		switch (key) {
			case 'roster':     return { maxCapacity: 8 }
			case 'sessions':   return { durationMinutes: 90 }
			case 'instructor': return { required: true }
			case 'editions':   return {}
			case 'inventory':  return { perParticipant: true as const }
			case 'credits':    return { creditsIncluded: 5, validityMode: 'season', compatibleServiceIds: [] }
			default:           return {}
		}
	}

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

	// ── Module picker derived state ───────────────────────────────────────────
	const activeModDefs = $derived(MODULE_DEFINITIONS.filter(mod =>
		mod.key === 'instructor' ? !!(modules as any).instructor?.required : mod.key in (modules as Record<string, unknown>)
	));
	const inactiveModDefs = $derived(MODULE_DEFINITIONS.filter(mod =>
		mod.key === 'instructor' ? !(modules as any).instructor?.required : !(mod.key in (modules as Record<string, unknown>))
	));

	function activateModule(key: string) {
		if (key === 'instructor') {
			modules = { ...modules, instructor: { required: true } } as any;
		} else {
			modules = { ...modules, [key]: getDefaultConfig(key) } as any;
		}
	}
	function deactivateModule(key: string) {
		if (key === 'instructor') {
			const { instructor: _, ...rest } = modules as any;
			modules = rest as any;
		} else {
			const { [key]: _, ...rest } = modules as Record<string, unknown>;
			modules = rest as any;
		}
	}
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
						onclick={() => selectedTemplateId = t.id as TemplateId}
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

		<div>
			<label class="label mb-2">{m.service_new_color()}</label>
			<ColorPicker selected={form?.values?.color ?? 'ocean'} />
		</div>

		<div>
			<label class="label">{m.common_description()}</label>
			<textarea name="description" rows="2" class="input"
				placeholder={m.service_new_description_placeholder()}>{form?.values?.description ?? ''}</textarea>
		</div>

		<!-- Capabilities: active module cards + inactive chips -->
		<div>
			<p class="label mb-2">Capacidades</p>

			{#if activeModDefs.length > 0}
				<div class="space-y-2.5">
					{#each activeModDefs as mod (mod.key)}
						<div class="rounded-lg border-2 border-ocean/30 bg-ocean/5 p-3 space-y-2.5">
							<div class="flex items-center justify-between">
								<span class="text-sm font-semibold text-gray-900">{mod.icon} {mod.label}</span>
								<button type="button" onclick={() => deactivateModule(mod.key)}
									class="text-[10px] text-muted hover:text-red-500">✕ Quitar</button>
							</div>

							{#if mod.key === 'sessions'}
								<div class="grid grid-cols-2 gap-2">
									<div>
										<label class="mb-0.5 block text-xs text-muted">Duración (min)</label>
										<input name="durationMinutes" type="number" min="15" step="15"
											class="input" placeholder="90" />
									</div>
									{#if !modules.roster}
										<div>
											<label class="mb-0.5 block text-xs text-muted">Sesiones incluidas</label>
											<input name="defaultSessionsIncluded" type="number" min="1"
												class="input" placeholder="1" />
										</div>
									{/if}
								</div>
							{:else if mod.key === 'roster'}
								<div>
									<label class="mb-0.5 block text-xs text-muted">Capacidad máxima</label>
									<input name="maxCapacity" type="number" min="1" step="1" required
										class="input" placeholder="8" />
								</div>
							{:else if mod.key === 'inventory'}
								{#if !modules.roster}
									<div>
										<label class="mb-0.5 block text-xs text-muted">Unidades disponibles</label>
										<input name="maxCapacity" type="number" min="1" step="1"
											class="input" placeholder="10" />
									</div>
								{/if}
							{:else if mod.key === 'instructor'}
								{#if data.instructors.length > 0}
									<div class="space-y-1">
										<p class="text-xs text-muted">Instructores por defecto</p>
										<div class="space-y-1.5">
											{#each data.instructors as instructor}
												<label class="flex cursor-pointer items-center gap-2">
													<input type="checkbox" name="defaultInstructorId" value={instructor.id}
														checked={false}
														class="h-3.5 w-3.5 accent-ocean" />
													<span class="text-xs text-gray-700">{instructor.name}</span>
												</label>
											{/each}
										</div>
									</div>
								{/if}
							{:else if mod.key === 'credits'}
								<div class="grid grid-cols-2 gap-2">
									<div>
										<label class="mb-0.5 block text-xs text-muted">Créditos incluidos</label>
										<input type="number" min="1" step="1" class="input" placeholder="5"
											value={(modules as any).credits?.creditsIncluded ?? 5}
											oninput={(e) => {
												const v = parseInt((e.target as HTMLInputElement).value) || 5;
												modules = { ...modules, credits: { ...(modules as any).credits, creditsIncluded: v, validityMode: (modules as any).credits?.validityMode ?? 'season', compatibleServiceIds: [] } } as any;
											}} />
									</div>
									<div>
										<label class="mb-0.5 block text-xs text-muted">Validez</label>
										<select class="input"
											onchange={(e) => {
												modules = { ...modules, credits: { ...(modules as any).credits, validityMode: (e.target as HTMLSelectElement).value, creditsIncluded: (modules as any).credits?.creditsIncluded ?? 5, compatibleServiceIds: [] } } as any;
											}}>
											<option value="season" selected={(modules as any).credits?.validityMode !== 'days'}>Temporada</option>
											<option value="days" selected={(modules as any).credits?.validityMode === 'days'}>Días</option>
										</select>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if inactiveModDefs.length > 0}
				<div class="flex flex-wrap gap-2 pt-1">
					{#each inactiveModDefs as mod (mod.key)}
						<button type="button" onclick={() => activateModule(mod.key)}
							class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-ocean hover:text-ocean transition-colors">
							{mod.icon} {mod.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary btn-block">
			{loading ? m.common_saving() : m.service_new_submit()}
		</button>
	</form>
</div>
