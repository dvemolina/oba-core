<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from 'lucide-svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { MODULE_DEFINITIONS } from '$lib/modules/index';
	import type { ServiceModules } from '$lib/features/services/modules';
	import { PRICING_MODE_OPTIONS, defaultPricingMode } from '$lib/utils/pricing';
	import type { Service } from '$lib/features/services/types';
	import type { ServiceEdition } from '$lib/features/services/editions.types';
	import type { ServiceInventoryLinkWithType, InventoryItemType } from '$lib/features/inventory/types';
	import type { PricingMode } from '$lib/features/services/types';
	import * as m from '$lib/paraglide/messages';

	interface Instructor { id: string; name: string }

	// ── Props ──────────────────────────────────────────────────────────────────
	let {
		service = undefined as Service | undefined,
		canEdit = true,
		instructors = [] as Instructor[],
		allItemTypes = [] as InventoryItemType[],
		existingRuns = [] as ServiceEdition[],
		existingLinks = [] as ServiceInventoryLinkWithType[],
		formError = null as string | null,
		formValues = null as Record<string, string> | null
	} = $props();

	const isCreate = $derived(service === undefined);

	// ── Presets (create only) ──────────────────────────────────────────────────
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
			modules: { sessions: {}, credits: { creditsIncluded: 5, validityMode: 'range', compatibleServiceIds: [] } }
		},
		{ id: 'other', label: 'Otro', icon: '✦', modules: {} }
	];

	// ── Module state ───────────────────────────────────────────────────────────
	let modules = $state<ServiceModules>(structuredClone(service?.modules ?? {}));
	let appliedPresetId = $state<string | null>(null);

	function getDefaultConfig(key: string): Record<string, unknown> {
		switch (key) {
			case 'roster':     return { maxCapacity: 8 };
			case 'sessions':   return { durationMinutes: 90 };
			case 'instructor': return { required: true };
			case 'editions':   return {};
			case 'inventory':  return { perParticipant: true };
			case 'credits':    return { creditsIncluded: 5, validityMode: 'range', compatibleServiceIds: [] };
			default:           return {};
		}
	}

	function applyPreset(preset: (typeof PRESETS)[number]) {
		modules = { ...preset.modules };
		appliedPresetId = preset.id;
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

	const smartPricingMode = $derived(defaultPricingMode(modules));
	const derivedType = $derived(
		appliedPresetId ??
		('credits' in modules ? 'credits' :
		'editions' in modules && 'roster' in modules ? 'camp' :
		'inventory' in modules ? 'rental' :
		'sessions' in modules ? 'lesson' : 'other')
	);
	const hasEditions  = $derived('editions'    in (modules as Record<string, unknown>));
	const hasInventory = $derived('inventory'   in (modules as Record<string, unknown>));
	const hasRoster    = $derived('roster'      in (modules as Record<string, unknown>));

	// ── Draft editions (new editions to add, pre-submission) ──────────────────
	type DraftEdition = { uid: string; startDate: string; endDate: string; maxCapacity: string; notes: string };
	let draftEditions = $state<DraftEdition[]>([]);
	let newEd = $state({ startDate: '', endDate: '', maxCapacity: '', notes: '' });
	let edError = $state('');

	function addDraftEdition() {
		edError = '';
		if (!newEd.startDate || !newEd.endDate) { edError = 'Fechas requeridas'; return; }
		if (newEd.startDate >= newEd.endDate) { edError = 'Fin debe ser posterior al inicio'; return; }
		draftEditions = [...draftEditions, { uid: crypto.randomUUID(), ...newEd }];
		newEd = { startDate: '', endDate: '', maxCapacity: '', notes: '' };
	}
	function removeDraftEdition(uid: string) {
		draftEditions = draftEditions.filter(e => e.uid !== uid);
	}

	// ── Draft links (new inventory links to add, pre-submission) ──────────────
	type DraftLink = {
		uid: string; itemTypeId: string; quantityPerBooking: number;
		isIncluded: boolean; addonPrice: string; addonPricingMode: string; isOptional: boolean;
	};
	let draftLinks = $state<DraftLink[]>([]);
	let newLink = $state({ itemTypeId: '', quantityPerBooking: 1, isIncluded: true, addonPrice: '', addonPricingMode: '', isOptional: true });
	let linkError = $state('');

	function addDraftLink() {
		linkError = '';
		if (!newLink.itemTypeId) { linkError = 'Selecciona un tipo de producto'; return; }
		if (draftLinks.some(l => l.itemTypeId === newLink.itemTypeId) ||
			existingLinks.some(l => l.itemTypeId === newLink.itemTypeId)) {
			linkError = 'Este tipo ya está vinculado';
			return;
		}
		draftLinks = [...draftLinks, { uid: crypto.randomUUID(), ...newLink }];
		newLink = { itemTypeId: '', quantityPerBooking: 1, isIncluded: true, addonPrice: '', addonPricingMode: '', isOptional: true };
	}
	function removeDraftLink(uid: string) { draftLinks = draftLinks.filter(l => l.uid !== uid); }

	// Inline edit state for existing links (edit mode)
	let editingLinkId = $state<string | null>(null);

	// Serialised JSON payloads attached as hidden inputs
	const editionsJson = $derived(
		JSON.stringify(draftEditions.map(e => ({
			startDate: e.startDate,
			endDate: e.endDate,
			maxCapacity: e.maxCapacity ? parseInt(e.maxCapacity) : null,
			notes: e.notes || null
		})))
	);
	const linksJson = $derived(
		JSON.stringify(draftLinks.map(l => ({
			itemTypeId: l.itemTypeId,
			quantityPerBooking: l.quantityPerBooking,
			isIncluded: l.isIncluded,
			addonPrice: l.isIncluded ? null : (l.addonPrice || null),
			addonPricingMode: l.isIncluded ? null : (l.addonPricingMode || null),
			isOptional: l.isOptional
		})))
	);

	// Pricing mode options (i18n labels)
	const PRICING_OPTIONS = $derived(PRICING_MODE_OPTIONS.map(o => ({
		value: o.value,
		label: (m as any)[`pricing_mode_${o.value}`]?.() ?? o.label
	})));

	function pricingModeLabel(mode: string | null): string {
		if (!mode) return '—';
		return PRICING_OPTIONS.find(o => o.value === mode)?.label ?? mode;
	}

	// Available item types for new link (exclude already linked)
	const availableItemTypes = $derived(
		allItemTypes.filter(t =>
			!existingLinks.some(l => l.itemTypeId === t.id) &&
			!draftLinks.some(l => l.itemTypeId === t.id)
		)
	);

	let loading = $state(false);
	const suggestedLabel = $derived((m as any)[`pricing_mode_${smartPricingMode}`]?.() ?? null);

	// Sync module state when server data refreshes (after save)
	$effect(() => {
		if (service) {
			modules = structuredClone((service.modules as ServiceModules) ?? {});
			draftEditions = [];
			draftLinks = [];
		}
	});
</script>

<!-- ─────────────────────────────────────────────────────────────────────────── -->
<!-- Main form -->
<form
	id="service-form"
	method="post"
	action={isCreate ? undefined : '?/update'}
	class="space-y-6"
	use:enhance={() => {
		loading = true;
		return async ({ update }) => { loading = false; update(); };
	}}
>
	<!-- Hidden state -->
	<input type="hidden" name="modules" value={JSON.stringify(modules)} />
	<input type="hidden" name="type" value={derivedType} />
	<!-- Draft editions + links: always send, server handles empty arrays gracefully -->
	<input type="hidden" name="newEditions" value={editionsJson} />
	<input type="hidden" name="newLinks" value={linksJson} />
	{#if service}
		<input type="hidden" name="serviceId" value={service.id} />
	{/if}

	<!-- ── Quick-start presets (create only) ─────────────────────────────── -->
	{#if isCreate}
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
	{/if}

	<!-- ── Name ──────────────────────────────────────────────────────────── -->
	<div>
		<label class="label" for="svc-name">Nombre *</label>
		<input id="svc-name" name="name" required
			value={formValues?.name ?? service?.name ?? ''}
			class="input" placeholder="Ej. Clase de surf — principiantes" />
	</div>

	<!-- ── Módulos del servicio ───────────────────────────────────────────── -->
	<div>
		<p class="label mb-1">Módulos del servicio</p>
		<p class="mb-3 text-xs text-muted">Los módulos activos definen cómo funciona este servicio.</p>

		<div class="space-y-2">
			{#each MODULE_DEFINITIONS as mod (mod.key)}
				{@const isActive = mod.key in (modules as Record<string, unknown>)}
				<div class="rounded-xl border transition-colors {isActive ? 'border-ocean/40 bg-ocean/5' : 'border-border bg-surface'}">
					<!-- Toggle header -->
					<button type="button"
						onclick={() => isActive ? deactivateModule(mod.key) : activateModule(mod.key)}
						class="flex w-full items-center gap-3 p-3.5 text-left">
						<span class="text-base leading-none transition-opacity {isActive ? 'opacity-100' : 'opacity-30'}">{mod.icon}</span>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold transition-colors {isActive ? 'text-navy' : 'text-muted'}">{mod.label}</p>
							<p class="text-[11px] leading-snug {isActive ? 'text-muted' : 'text-border'}">{mod.description}</p>
						</div>
						<div class="relative shrink-0 h-5 w-9 rounded-full transition-colors duration-200 {isActive ? 'bg-ocean' : 'bg-gray-300'}">
							<span class="absolute inset-y-0.5 w-4 rounded-full bg-white shadow-sm transition-all duration-200 {isActive ? 'right-0.5' : 'left-0.5'}"></span>
						</div>
					</button>

					{#if isActive}
						<div class="border-t border-ocean/20 px-3.5 pb-3.5 pt-3 space-y-4">

							<!-- Sessions config -->
							{#if mod.key === 'sessions'}
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="mb-1 block text-xs font-medium text-gray-600">Duración por sesión (min)</label>
										<input name="durationMinutes" type="number" min="15" step="15"
											value={(modules as any).sessions?.durationMinutes ?? service?.durationMinutes ?? 90}
											class="input" placeholder="90" />
									</div>
									{#if !hasRoster}
										<div>
											<label class="mb-1 block text-xs font-medium text-gray-600">Sesiones incluidas por defecto</label>
											<input name="defaultSessionsIncluded" type="number" min="1" class="input" placeholder="1"
												value={service?.defaultSessionsIncluded ?? ''} />
											<p class="mt-1 text-[11px] text-muted">{m.service_form_sessions_pack_help()}</p>
										</div>
									{/if}
								</div>

							<!-- Roster config -->
							{:else if mod.key === 'roster'}
								<div class="max-w-xs">
									<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_detail_max_capacity()}</label>
									<input name="maxCapacity" type="number" min="1" step="1" required
										value={(modules as any).roster?.maxCapacity ?? service?.maxCapacity ?? 8}
										class="input" placeholder="8" />
									<p class="mt-1 text-[11px] text-muted">{m.service_form_roster_capacity_help()}</p>
								</div>

							<!-- Editions: config + edition list ─────────────────────────── -->
							{:else if mod.key === 'editions'}
								<div class="space-y-3">
									<p class="text-xs text-muted">Instancias del servicio con fechas concretas (ej. camp de julio, camp de agosto).</p>

									<!-- Existing editions (edit mode only) -->
									{#if !isCreate && existingRuns.length > 0}
										<div class="space-y-1.5">
											{#each existingRuns as run (run.id)}
												<div class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium text-gray-800">{run.startDate} → {run.endDate}</p>
														<p class="text-xs text-muted">
															{#if run.maxCapacity}{run.enrolledCount}/{run.maxCapacity} plazas{/if}
															{#if run.notes} · {run.notes}{/if}
														</p>
													</div>
													<span class="shrink-0 rounded-full bg-ocean/10 px-2 py-0.5 text-[10px] font-medium text-ocean">
														{run.enrolledCount} inscritos
													</span>
													{#if run.enrolledCount === 0}
														<button type="submit" form="del-run-{run.id}"
															class="shrink-0 rounded p-1 text-gray-400 hover:text-red-500 transition-colors"
															onclick={(e) => { if (!confirm('¿Eliminar esta edición?')) e.preventDefault(); }}>
															<Trash2 size={13} />
														</button>
													{/if}
												</div>
											{/each}
										</div>
									{:else if !isCreate && existingRuns.length === 0}
										<p class="text-xs text-muted italic">Sin ediciones aún.</p>
									{/if}

									<!-- Draft editions (pending, both modes) -->
									{#if draftEditions.length > 0}
										<div class="space-y-1.5">
											{#each draftEditions as ed (ed.uid)}
												<div class="flex items-center gap-3 rounded-lg border border-ocean/30 bg-ocean/5 px-3 py-2.5">
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium text-ocean">{ed.startDate} → {ed.endDate}</p>
														<p class="text-xs text-muted">
															{#if ed.maxCapacity}Máx {ed.maxCapacity} plazas{/if}
															{#if ed.notes} · {ed.notes}{/if}
														</p>
													</div>
													<span class="text-[10px] text-ocean/70">por guardar</span>
													<button type="button" onclick={() => removeDraftEdition(ed.uid)}
														class="shrink-0 rounded p-1 text-ocean/40 hover:text-red-500 transition-colors">
														<Trash2 size={13} />
													</button>
												</div>
											{/each}
										</div>
									{/if}

									<!-- Add new edition form -->
									<div class="rounded-lg border border-dashed border-border/70 p-3 space-y-2.5">
										<p class="text-[11px] font-semibold uppercase tracking-wide text-muted">{m.service_form_edition_add_section()}</p>
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label class="mb-1 block text-[11px] font-medium text-gray-600">Inicio</label>
												<input type="date" bind:value={newEd.startDate} class="input" />
											</div>
											<div>
												<label class="mb-1 block text-[11px] font-medium text-gray-600">Fin</label>
												<input type="date" bind:value={newEd.endDate} class="input" />
											</div>
											<div>
												<label class="mb-1 block text-[11px] font-medium text-gray-600">Capacidad <span class="text-border">(opcional)</span></label>
												<input type="number" min="1" bind:value={newEd.maxCapacity} class="input" placeholder="—" />
												<p class="mt-0.5 text-[10px] text-muted">{m.service_form_edition_capacity_help()}</p>
											</div>
											<div>
												<label class="mb-1 block text-[11px] font-medium text-gray-600">Notas <span class="text-border">(opcional)</span></label>
												<input type="text" bind:value={newEd.notes} class="input" placeholder="Camp julio" />
											</div>
										</div>
										{#if edError}<p class="text-xs text-red-600">{edError}</p>{/if}
										<button type="button" onclick={addDraftEdition}
											class="rounded-lg bg-ocean/10 px-3 py-1.5 text-xs font-semibold text-ocean hover:bg-ocean/20 transition-colors">
											Añadir edición
										</button>
									</div>
								</div>

							<!-- Instructor config -->
							{:else if mod.key === 'instructor'}
								{#if instructors.length > 0}
									<div>
										<p class="mb-1.5 text-xs font-medium text-gray-600">Instructores por defecto <span class="text-muted">(opcional)</span></p>
										<div class="flex flex-wrap gap-3">
											{#each instructors as instructor}
												<label class="flex cursor-pointer items-center gap-2">
													<input type="checkbox" name="defaultInstructorId" value={instructor.id}
														checked={service?.defaultInstructorIds?.includes(instructor.id) ?? false}
														class="h-3.5 w-3.5 accent-ocean" />
													<span class="text-xs text-gray-700">{instructor.name}</span>
												</label>
											{/each}
										</div>
									</div>
								{:else}
									<p class="text-xs text-muted italic">No hay instructores dados de alta aún.</p>
								{/if}

							<!-- Inventory: link config ───────────────────────────────────── -->
							{:else if mod.key === 'inventory'}
								<div class="space-y-3">
									<!-- perParticipant toggle -->
									<label class="flex cursor-pointer items-center gap-2.5">
										<input type="checkbox"
											checked={(modules as any).inventory?.perParticipant !== false}
											onchange={(e) => {
												modules = { ...modules, inventory: { perParticipant: (e.target as HTMLInputElement).checked } } as any;
											}}
											class="h-4 w-4 rounded accent-ocean" />
										<div>
											<p class="text-xs font-semibold text-gray-700">Por participante</p>
											<p class="text-[11px] text-muted">Activo: cada participante consume {m.service_form_inventory_qty_per_booking().toLowerCase()} de unidades. Desactivado: la reserva entera consume una cantidad fija.</p>
										</div>
									</label>
									<!-- Existing links (edit mode) -->
									{#if !isCreate && existingLinks.length > 0}
										<div class="space-y-1.5">
											{#each existingLinks as link (link.id)}
												<div class="overflow-hidden rounded-lg border border-border">
													<div class="flex items-start justify-between gap-3 px-3 py-2.5">
														<div class="min-w-0">
															<p class="text-sm font-medium text-gray-900">{link.itemType.name}</p>
															<p class="text-xs text-gray-500">
																{link.quantityPerBooking}× ·
																{link.isIncluded ? 'Incluido' : 'Add-on'}
																{#if !link.isIncluded && link.addonPrice}
																	· €{link.addonPrice} {pricingModeLabel(link.addonPricingMode)}
																	{link.isOptional ? '(opcional)' : '(obligatorio)'}
																{/if}
															</p>
														</div>
														<div class="flex shrink-0 gap-1">
															<button type="button"
																onclick={() => editingLinkId = editingLinkId === link.id ? null : link.id}
																class="rounded px-2 py-1 text-xs text-ocean hover:bg-ocean/5">
																{editingLinkId === link.id ? 'Cerrar' : 'Editar'}
															</button>
															<button type="submit" form="rem-link-{link.id}"
																class="rounded p-1 text-gray-400 hover:text-red-500 transition-colors">
																<Trash2 size={13} />
															</button>
														</div>
													</div>
													{#if editingLinkId === link.id}
														<div class="border-t border-border/50 bg-sand/40 px-3 py-3 space-y-2">
															<input form="upd-link-{link.id}" type="hidden" name="linkId" value={link.id} />
															<div class="grid grid-cols-2 gap-2">
																<div>
																	<label class="mb-1 block text-[11px] font-medium text-gray-600">Cantidad por reserva</label>
																	<input form="upd-link-{link.id}" name="quantityPerBooking" type="number" min="1" value={link.quantityPerBooking}
																		class="input" />
																</div>
																<div class="flex items-center gap-2 self-end pb-1">
																	<input form="upd-link-{link.id}" id="inc_{link.id}" name="isIncluded" type="checkbox" value="true"
																		checked={link.isIncluded} class="h-3.5 w-3.5 rounded accent-ocean" />
																	<label for="inc_{link.id}" class="text-xs font-medium text-gray-600">Incluido en precio</label>
																</div>
																<div>
																	<label class="mb-1 block text-[11px] font-medium text-gray-600">Precio add-on (€)</label>
																	<input form="upd-link-{link.id}" name="addonPrice" type="number" step="0.01" min="0"
																		value={link.addonPrice ?? ''} placeholder="0.00" class="input" />
																</div>
																<div>
																	<label class="mb-1 block text-[11px] font-medium text-gray-600">Modo add-on</label>
																	<select form="upd-link-{link.id}" name="addonPricingMode" class="input">
																		<option value="">—</option>
																		{#each PRICING_OPTIONS as opt}
																			<option value={opt.value} selected={link.addonPricingMode === opt.value}>{opt.label}</option>
																		{/each}
																	</select>
																</div>
																<div class="col-span-2 flex items-center gap-2">
																	<input form="upd-link-{link.id}" id="opt_{link.id}" name="isOptional" type="checkbox" value="true"
																		checked={link.isOptional} class="h-3.5 w-3.5 rounded accent-ocean" />
																	<label for="opt_{link.id}" class="text-xs font-medium text-gray-600">El cliente puede rechazar (add-on opcional)</label>
																</div>
															</div>
															<button type="submit" form="upd-link-{link.id}" class="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-white">Guardar</button>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}

									<!-- Draft links (pending, both modes) -->
									{#if draftLinks.length > 0}
										<div class="space-y-1.5">
											{#each draftLinks as lnk (lnk.uid)}
												{@const itemType = allItemTypes.find(t => t.id === lnk.itemTypeId)}
												<div class="flex items-center gap-3 rounded-lg border border-ocean/30 bg-ocean/5 px-3 py-2.5">
													<div class="flex-1 min-w-0">
														<p class="text-sm font-medium text-ocean">{itemType?.name ?? lnk.itemTypeId}</p>
														<p class="text-xs text-muted">
															{lnk.quantityPerBooking}× ·
															{lnk.isIncluded ? 'Incluido' : `Add-on €${lnk.addonPrice || '—'}`}
														</p>
													</div>
													<span class="text-[10px] text-ocean/70">por guardar</span>
													<button type="button" onclick={() => removeDraftLink(lnk.uid)}
														class="shrink-0 rounded p-1 text-ocean/40 hover:text-red-500 transition-colors">
														<Trash2 size={13} />
													</button>
												</div>
											{/each}
										</div>
									{/if}

									{#if allItemTypes.length === 0}
										<div class="rounded-lg bg-amber-50 p-3">
											<p class="text-xs text-amber-700">No hay tipos de inventario. <a href="/inventory/new" class="underline">Crear tipo de producto</a></p>
										</div>
									{:else if availableItemTypes.length > 0}
										<!-- Add new link form -->
										<div class="rounded-lg border border-dashed border-border/70 p-3 space-y-2.5">
											<p class="text-[11px] font-semibold uppercase tracking-wide text-muted">{m.service_form_inventory_link_section()}</p>
											<div class="grid grid-cols-2 gap-2">
												<div class="col-span-2">
													<label class="mb-1 block text-[11px] font-medium text-gray-600">Tipo de producto</label>
													<select bind:value={newLink.itemTypeId} class="input w-full">
														<option value="">— Seleccionar —</option>
														{#each availableItemTypes as t}
															<option value={t.id}>{t.name}{#if t.description} — {t.description}{/if}</option>
														{/each}
													</select>
												</div>
												<div>
													<label class="mb-1 block text-[11px] font-medium text-gray-600">Cantidad por reserva</label>
													<input type="number" min="1" bind:value={newLink.quantityPerBooking} class="input" />
												</div>
												<div class="flex items-center gap-2 self-end pb-1">
													<input id="newLinkIncluded" type="checkbox" bind:checked={newLink.isIncluded}
														class="h-3.5 w-3.5 rounded accent-ocean" />
													<label for="newLinkIncluded" class="text-xs font-medium text-gray-600">Incluido en precio</label>
												</div>
												{#if !newLink.isIncluded}
													<div>
														<label class="mb-1 block text-[11px] font-medium text-gray-600">Precio add-on (€)</label>
														<input type="number" step="0.01" min="0" bind:value={newLink.addonPrice}
															class="input" placeholder="0.00" />
													</div>
													<div>
														<label class="mb-1 block text-[11px] font-medium text-gray-600">Modo de precio</label>
														<select bind:value={newLink.addonPricingMode} class="input">
															<option value="">—</option>
															{#each PRICING_OPTIONS as opt}
																<option value={opt.value}>{opt.label}</option>
															{/each}
														</select>
													</div>
													<div class="col-span-2 flex items-center gap-2">
														<input id="newLinkOptional" type="checkbox" bind:checked={newLink.isOptional}
															class="h-3.5 w-3.5 rounded accent-ocean" />
														<label for="newLinkOptional" class="text-xs font-medium text-gray-600">Add-on opcional</label>
													</div>
												{/if}
											</div>
											{#if linkError}<p class="text-xs text-red-600">{linkError}</p>{/if}
											<button type="button" onclick={addDraftLink}
												class="rounded-lg bg-ocean/10 px-3 py-1.5 text-xs font-semibold text-ocean hover:bg-ocean/20 transition-colors">
												Vincular
											</button>
										</div>
									{:else}
										<p class="text-xs text-muted italic">Todos los tipos de producto ya están vinculados.</p>
									{/if}
								</div>

							<!-- Credits config -->
							{:else if mod.key === 'credits'}
								{@const credConfig = { creditsIncluded: 5, validityMode: 'range' as 'range'|'days', compatibleServiceIds: [] as string[], ...((modules as any).credits ?? {}) }}
								<div class="space-y-3">
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_form_credits_count()}</label>
											<input type="number" min="1" step="1" class="input" placeholder="5"
												value={credConfig.creditsIncluded}
												oninput={(e) => {
													const v = parseInt((e.target as HTMLInputElement).value) || 5;
													modules = { ...modules, credits: { ...credConfig, creditsIncluded: v } } as any;
												}} />
										</div>
										<div>
											<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_form_credits_validity_type()}</label>
											<select class="input"
												onchange={(e) => {
													modules = { ...modules, credits: { ...credConfig, validityMode: (e.target as HTMLSelectElement).value as 'range'|'days' } } as any;
												}}>
												<option value="range" selected={credConfig.validityMode !== 'days'}>{m.service_form_credits_validity_range()}</option>
												<option value="days" selected={credConfig.validityMode === 'days'}>{m.service_form_credits_validity_days()}</option>
											</select>
										</div>
									</div>
									{#if credConfig.validityMode === 'days'}
										<div class="max-w-xs">
											<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_form_credits_days_count()}</label>
											<input type="number" min="1" class="input" placeholder="30"
												value={(credConfig as any).validityDays ?? 30}
												oninput={(e) => {
													const v = parseInt((e.target as HTMLInputElement).value) || 30;
													modules = { ...modules, credits: { ...credConfig, validityDays: v } } as any;
												}} />
										</div>
									{:else}
										<div class="grid grid-cols-2 gap-3">
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_form_credits_valid_from()}</label>
												<input type="date" class="input"
													value={(credConfig as any).validFrom ?? ''}
													onchange={(e) => {
														const v = (e.target as HTMLInputElement).value;
														modules = { ...modules, credits: { ...credConfig, validFrom: v || undefined } } as any;
													}} />
											</div>
											<div>
												<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_form_credits_valid_to()}</label>
												<input type="date" class="input"
													value={(credConfig as any).validTo ?? ''}
													onchange={(e) => {
														const v = (e.target as HTMLInputElement).value;
														modules = { ...modules, credits: { ...credConfig, validTo: v || undefined } } as any;
													}} />
											</div>
										</div>
									{/if}
								</div>
							{/if}

						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- ── Precio + modo ──────────────────────────────────────────────────── -->
	{#if canEdit}
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="label" for="svc-price">Precio base *</label>
				<input id="svc-price" name="basePrice" type="number" step="0.01" min="0" required
					value={formValues?.basePrice ?? service?.basePrice ?? ''}
					class="input" placeholder="40.00" />
			</div>
			<div>
				<label class="label" for="svc-pricing-mode">Modo de precio</label>
				<select id="svc-pricing-mode" name="pricingMode" class="input">
					<option value="">— {m.pricing_mode_manual()} —</option>
					{#each PRICING_OPTIONS as opt}
						<option value={opt.value} selected={
							(service?.pricingMode ?? smartPricingMode) === opt.value
						}>{opt.label}</option>
					{/each}
				</select>
				{#if suggestedLabel}
					<p class="mt-1 text-[11px] text-muted">{m.pricing_mode_suggested({ mode: suggestedLabel })}</p>
				{/if}
			</div>
		</div>
	{:else}
		<input type="hidden" name="basePrice" value={service?.basePrice ?? ''} />
		<div>
			<p class="label">Precio base</p>
			<p class="text-sm text-muted">Gestionado por administración</p>
		</div>
	{/if}

	<!-- ── Color ──────────────────────────────────────────────────────────── -->
	<div>
		<label class="label mb-2">Color</label>
		<ColorPicker selected={formValues?.color ?? service?.color ?? 'ocean'} />
	</div>

	<!-- ── Descripción ────────────────────────────────────────────────────── -->
	<div>
		<label class="label" for="svc-desc">Descripción</label>
		<textarea id="svc-desc" name="description" rows="2" class="input"
			placeholder="Descripción del servicio (opcional)">{formValues?.description ?? service?.description ?? ''}</textarea>
	</div>

	<!-- ── Error ──────────────────────────────────────────────────────────── -->
	{#if formError}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
	{/if}

	<!-- ── Submit ─────────────────────────────────────────────────────────── -->
	<button type="submit" disabled={loading} class="btn-primary btn-block">
		{loading ? 'Guardando…' : isCreate ? 'Crear servicio' : 'Guardar cambios'}
	</button>
</form>

<!-- Satellite forms — outside main form to avoid invalid nesting -->
{#if !isCreate}
	{#each existingRuns as run (run.id)}
		{#if run.enrolledCount === 0}
			<form id="del-run-{run.id}" method="POST" action="?/deleteRun" use:enhance>
				<input type="hidden" name="runId" value={run.id} />
			</form>
		{/if}
	{/each}
	{#each existingLinks as link (link.id)}
		<form id="rem-link-{link.id}" method="POST" action="?/removeInventoryLink" use:enhance>
			<input type="hidden" name="linkId" value={link.id} />
		</form>
		<form id="upd-link-{link.id}" method="POST" action="?/updateInventoryLink"
			use:enhance={() => async ({ result, update }) => {
				if (result.type === 'success') editingLinkId = null;
				await update();
			}}></form>
	{/each}
{/if}
