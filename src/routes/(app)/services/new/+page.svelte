<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { PRICING_MODE_OPTIONS, defaultPricingMode } from '$lib/utils/pricing';
	import { MODULE_DEFINITIONS } from '$lib/modules/index';
	import type { ServiceModules } from '$lib/features/services/modules';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	// ── Quick-start presets ───────────────────────────────────────────────────
	const PRESETS: { id: string; label: string; icon: string; modules: ServiceModules }[] = [
		{
			id: 'lesson',
			label: 'Clase particular',
			icon: '🏄',
			modules: { sessions: { durationMinutes: 90 }, instructor: { required: true } }
		},
		{
			id: 'camp',
			label: 'Surf camp',
			icon: '⛺',
			modules: { sessions: {}, roster: { maxCapacity: 8 }, editions: {}, instructor: { required: true } }
		},
		{
			id: 'rental',
			label: 'Alquiler',
			icon: '🎒',
			modules: { inventory: { perParticipant: true } }
		},
		{
			id: 'credits',
			label: 'Bonos / créditos',
			icon: '🎟',
			modules: { sessions: {}, credits: { creditsIncluded: 5, validityMode: 'season', compatibleServiceIds: [] } }
		},
		{
			id: 'other',
			label: 'Otro',
			icon: '✦',
			modules: {}
		},
	];

	// ── Module state ──────────────────────────────────────────────────────────
	let modules = $state<ServiceModules>({});
	let appliedPresetId = $state<string | null>(null);

	function applyPreset(preset: typeof PRESETS[number]) {
		modules = { ...preset.modules };
		appliedPresetId = preset.id;
	}

	function getDefaultConfig(key: string): Record<string, unknown> {
		switch (key) {
			case 'roster':     return { maxCapacity: 8 };
			case 'sessions':   return { durationMinutes: 90 };
			case 'instructor': return { required: true };
			case 'editions':   return {};
			case 'inventory':  return { perParticipant: true };
			case 'credits':    return { creditsIncluded: 5, validityMode: 'season', compatibleServiceIds: [] };
			default:           return {};
		}
	}

	function activateModule(key: string) {
		modules = { ...modules, [key]: getDefaultConfig(key) } as ServiceModules;
		appliedPresetId = null;
	}

	function deactivateModule(key: string) {
		const { [key]: _, ...rest } = modules as Record<string, unknown>;
		modules = rest as ServiceModules;
		appliedPresetId = null;
	}

	// ── Derived ───────────────────────────────────────────────────────────────
	const activeModDefs = $derived(MODULE_DEFINITIONS.filter(mod => mod.key in (modules as Record<string, unknown>)));
	const inactiveModDefs = $derived(MODULE_DEFINITIONS.filter(mod => !(mod.key in (modules as Record<string, unknown>))));
	const smartPricingMode = $derived(defaultPricingMode(modules));

	// type hint derived from modules (display only, not business logic)
	const derivedType = $derived(
		appliedPresetId ??
		('credits' in modules ? 'credits' :
		'editions' in modules && 'roster' in modules ? 'camp' :
		'inventory' in modules ? 'rental' :
		'sessions' in modules ? 'lesson' : 'other')
	);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-semibold text-navy">{m.service_new_title()}</h1>
	</div>

	<form method="post" class="space-y-6"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; update(); };
		}}
	>
		<!-- Hidden state -->
		<input type="hidden" name="modules" value={JSON.stringify(modules)} />
		<input type="hidden" name="type" value={derivedType} />

		<!-- Quick-start presets — subtle, not the lead -->
		<div>
			<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Empezar desde plantilla</p>
			<div class="flex flex-wrap gap-2">
				{#each PRESETS as preset}
					<button
						type="button"
						onclick={() => applyPreset(preset)}
						class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors
							{appliedPresetId === preset.id
								? 'border-ocean bg-ocean/10 font-medium text-ocean'
								: 'border-border text-muted hover:border-ocean/50 hover:text-navy'}"
					>
						{preset.icon} {preset.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Name -->
		<div>
			<label class="label" for="name">{m.service_new_name()}</label>
			<input id="name" name="name" required value={form?.values?.name ?? ''}
				class="input" placeholder={m.service_new_name_placeholder()} />
		</div>

		<!-- ── Módulos — the core identity ─────────────────────────────────────── -->
		<div>
			<p class="label mb-1">Capacidades del servicio</p>
			<p class="mb-3 text-xs text-muted">Los módulos activos definen cómo funciona este servicio. Activa los que necesites.</p>

			<!-- Active module cards -->
			{#if activeModDefs.length > 0}
				<div class="space-y-3 mb-3">
					{#each activeModDefs as mod (mod.key)}
						<div class="rounded-xl border-2 border-ocean/40 bg-ocean/5 p-4">
							<div class="flex items-start justify-between mb-3">
								<div class="flex items-center gap-2">
									<span class="text-lg leading-none">{mod.icon}</span>
									<div>
										<p class="text-sm font-semibold text-navy">{mod.label}</p>
										<p class="text-[11px] text-muted leading-snug">{mod.description}</p>
									</div>
								</div>
								<button type="button" onclick={() => deactivateModule(mod.key)}
									class="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted hover:bg-red-50 hover:text-red-500 transition-colors">
									✕ Quitar
								</button>
							</div>

							<!-- Inline config per module -->
							{#if mod.key === 'sessions'}
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="durationMinutes">Duración por sesión (min)</label>
										<input id="durationMinutes" name="durationMinutes" type="number" min="15" step="15"
											value={(modules as any).sessions?.durationMinutes ?? 90}
											class="input" placeholder="90" />
									</div>
									{#if !('roster' in modules)}
										<div>
											<label class="mb-1 block text-xs font-medium text-gray-600" for="defaultSessionsIncluded">Sesiones incluidas por defecto</label>
											<input id="defaultSessionsIncluded" name="defaultSessionsIncluded" type="number" min="1"
												class="input" placeholder="1" />
										</div>
									{/if}
								</div>

							{:else if mod.key === 'roster'}
								<div class="max-w-xs">
									<label class="mb-1 block text-xs font-medium text-gray-600" for="maxCapacity">Capacidad máxima del grupo</label>
									<input id="maxCapacity" name="maxCapacity" type="number" min="1" step="1" required
										value={(modules as any).roster?.maxCapacity ?? 8}
										class="input" placeholder="8" />
								</div>

							{:else if mod.key === 'editions'}
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="startDate">Fecha inicio</label>
										<input id="startDate" name="startDate" type="date" class="input" />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600" for="endDate">Fecha fin</label>
										<input id="endDate" name="endDate" type="date" class="input" />
									</div>
								</div>
								<p class="mt-1.5 text-[11px] text-muted">Primera edición. Puedes añadir más ediciones después.</p>

							{:else if mod.key === 'inventory'}
								<div class="max-w-xs">
									<label class="mb-1 block text-xs font-medium text-gray-600" for="maxCapacity">Unidades disponibles</label>
									<input id="maxCapacity" name="maxCapacity" type="number" min="1" step="1"
										class="input" placeholder="10" />
								</div>

							{:else if mod.key === 'instructor'}
								{#if data.instructors.length > 0}
									<div>
										<p class="mb-1.5 text-xs font-medium text-gray-600">Instructores por defecto (opcional)</p>
										<div class="flex flex-wrap gap-3">
											{#each data.instructors as instructor}
												<label class="flex cursor-pointer items-center gap-2">
													<input type="checkbox" name="defaultInstructorId" value={instructor.id}
														class="h-3.5 w-3.5 accent-ocean" />
													<span class="text-xs text-gray-700">{instructor.name}</span>
												</label>
											{/each}
										</div>
									</div>
								{:else}
									<p class="text-xs text-muted italic">No hay instructores dados de alta aún.</p>
								{/if}

							{:else if mod.key === 'credits'}
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600">Créditos incluidos en el bono</label>
										<input type="number" min="1" step="1" class="input" placeholder="5"
											value={(modules as any).credits?.creditsIncluded ?? 5}
											oninput={(e) => {
												const v = parseInt((e.target as HTMLInputElement).value) || 5;
												modules = { ...modules, credits: { ...(modules as any).credits, creditsIncluded: v, validityMode: (modules as any).credits?.validityMode ?? 'season', compatibleServiceIds: [] } } as any;
											}} />
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600">Validez</label>
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
			{:else}
				<div class="mb-3 rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted">
					Activa al menos un módulo para definir qué puede hacer este servicio
				</div>
			{/if}

			<!-- Inactive modules — add chips -->
			{#if inactiveModDefs.length > 0}
				<div>
					<p class="mb-2 text-xs text-muted">Añadir capacidad:</p>
					<div class="flex flex-wrap gap-2">
						{#each inactiveModDefs as mod (mod.key)}
							<button type="button" onclick={() => activateModule(mod.key)}
								class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-ocean hover:bg-ocean/5 hover:text-ocean transition-colors">
								+ {mod.icon} {mod.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Price -->
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="label" for="basePrice">{m.service_new_base_price()}</label>
				<input id="basePrice" name="basePrice" type="number" step="0.01" min="0" required
					value={form?.values?.basePrice ?? ''}
					class="input" placeholder="40.00" />
			</div>
			<div>
				<label class="label" for="pricingMode">Modo de precio</label>
				<select id="pricingMode" name="pricingMode" class="input">
					<option value="">— manual —</option>
					{#each PRICING_MODE_OPTIONS as opt}
						<option value={opt.value} selected={smartPricingMode === opt.value}>
							{opt.label}
						</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Color + description -->
		<div>
			<label class="label mb-2">{m.service_new_color()}</label>
			<ColorPicker selected={form?.values?.color ?? 'ocean'} />
		</div>

		<div>
			<label class="label" for="description">{m.common_description()}</label>
			<textarea id="description" name="description" rows="2" class="input"
				placeholder={m.service_new_description_placeholder()}>{form?.values?.description ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary btn-block">
			{loading ? m.common_saving() : m.service_new_submit()}
		</button>
	</form>
</div>
