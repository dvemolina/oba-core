<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { Trash2 } from 'lucide-svelte';
	import { PRICING_MODE_OPTIONS, defaultPricingMode } from '$lib/utils/pricing';
	import type { ServiceModules } from '$lib/utils/pricing';
	import { MODULE_DEFINITIONS } from '$lib/modules/index';

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

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function pricingModeLabel(mode: string | null): string {
		if (!mode) return '';
		return PRICING_MODE_OPTIONS.find(o => o.value === mode)?.label ?? mode;
	}

	// Add-on editing state per link
	let editingLinkId = $state<string | null>(null);

	// ── RBAC ─────────────────────────────────────────────────────────────────
	const canEditServices = $derived(data.canEditServices);

	let editing = $state(false);
	let loading = $state(false);

	// Edit-mode modules (initialised from service, user can modify)
	let editModules = $state<ServiceModules>({ ...data.service.modules });

	const TEMPLATE_LABELS: Record<string, string> = {
		lesson: 'Lesson', camp: 'Camp / Course', product: 'Product',
		rental: 'Rental', accommodation: 'Accommodation', other: 'Other'
	};
	const LABEL_OPTIONS = ['lesson', 'camp', 'rental', 'accommodation', 'product', 'other'] as const;

	// Capability badge labels for view mode
	const capabilityBadges = $derived(
		MODULE_DEFINITIONS.filter(mod =>
			mod.key === 'instructor'
				? !!(data.service.modules as any)?.instructor?.required
				: mod.key in ((data.service.modules as Record<string, unknown>) ?? {})
		).map(mod => `${mod.icon} ${mod.label}`)
	);

	// ── Module picker derived state (edit mode) ───────────────────────────────
	const activeEditModDefs = $derived(MODULE_DEFINITIONS.filter(mod =>
		mod.key === 'instructor' ? !!(editModules as any).instructor?.required : mod.key in (editModules as Record<string, unknown>)
	));
	const inactiveEditModDefs = $derived(MODULE_DEFINITIONS.filter(mod =>
		mod.key === 'instructor' ? !(editModules as any).instructor?.required : !(mod.key in (editModules as Record<string, unknown>))
	));

	function activateEditModule(key: string) {
		if (key === 'instructor') {
			editModules = { ...editModules, instructor: { required: true } } as any;
		} else {
			editModules = { ...editModules, [key]: getDefaultConfig(key) } as any;
		}
	}
	function deactivateEditModule(key: string) {
		if (key === 'instructor') {
			const { instructor: _, ...rest } = editModules as any;
			editModules = rest as any;
		} else {
			const { [key]: _, ...rest } = editModules as Record<string, unknown>;
			editModules = rest as any;
		}
	}

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
			<span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-muted">{m.common_inactive()}</span>
		{/if}
	</div>

	{#if !editing}
	<!-- ── VIEW MODE ─────────────────────────────────────────────── -->

		<div class="mb-4 space-y-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			{#if canEditServices}
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_price()}</span>
				<span class="text-sm font-semibold text-gray-800">
					€{data.service.basePrice}{#if data.service.pricingMode} <span class="font-normal text-muted text-xs">· {pricingModeLabel(data.service.pricingMode)}</span>{/if}
				</span>
			</div>
			{:else}
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_price()}</span>
				<span class="text-sm text-muted">{m.service_detail_price_managed()}</span>
			</div>
			{/if}
			{#if data.service.durationMinutes}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_duration()}</span>
					<span class="text-sm text-gray-800">{data.service.durationMinutes} {m.service_detail_duration_min()}</span>
				</div>
			{/if}
			{#if data.service.maxCapacity}
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_max_capacity()}</span>
					<span class="text-sm text-gray-800">{data.service.maxCapacity}</span>
				</div>
			{/if}
			{#if capabilityBadges.length > 0}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_capabilities()}</span>
					<div class="mt-1.5 flex flex-wrap gap-1">
						{#each capabilityBadges as badge}
							<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if data.service.defaultInstructorIds?.length}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_instructors()}</span>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each data.instructors.filter(i => data.service.defaultInstructorIds?.includes(i.id)) as instructor}
							<span class="rounded-full bg-ocean/10 px-2.5 py-0.5 text-xs font-medium text-ocean">{instructor.name}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if data.service.description}
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-muted">{m.common_description()}</span>
					<p class="mt-1 text-sm text-gray-700">{data.service.description}</p>
				</div>
			{/if}
		</div>

		{#if data.service.modules?.inventory}
		<section class="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-gray-100 p-4">
				<h2 class="font-semibold text-gray-900">{m.service_detail_linked_inventory()}</h2>
				<a href="/inventory/new" class="text-xs text-ocean hover:underline">+ {m.inventory_btn_new_type()}</a>
			</div>

			{#if data.inventoryLinks.length === 0}
				<p class="p-4 text-sm text-gray-400">{m.service_detail_no_linked_inventory()}</p>
			{:else}
				<ul class="divide-y divide-gray-100">
				{#each data.inventoryLinks as link}
					<li class="px-4 py-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="text-sm font-medium text-gray-900">{link.itemType.name}</p>
								<p class="text-xs text-gray-500">
									{link.quantityPerBooking}×
									· {link.isIncluded ? m.service_detail_inventory_included() : m.service_detail_inventory_addon()}
									{#if !link.isIncluded && link.addonPrice}
										· €{link.addonPrice} {pricingModeLabel(link.addonPricingMode)}
										{link.isOptional ? '(optional)' : '(mandatory)'}
									{/if}
								</p>
							</div>
							{#if data.canEditServices}
							<div class="flex shrink-0 gap-1">
								<button type="button"
									onclick={() => { editingLinkId = editingLinkId === link.id ? null : link.id; }}
									class="rounded px-2 py-1 text-xs text-ocean hover:bg-ocean/5">Edit</button>
								<form method="POST" action="?/removeInventoryLink" use:enhance>
									<input type="hidden" name="linkId" value={link.id} />
									<button type="submit" class="rounded p-1 text-gray-400 hover:text-red-500">
										<Trash2 size={14} />
									</button>
								</form>
							</div>
							{/if}
						</div>

						{#if editingLinkId === link.id && data.canEditServices}
						<form method="POST" action="?/updateInventoryLink" use:enhance={() => () => async ({ result, update }) => {
							if (result.type === 'success') { toast('Link updated'); editingLinkId = null; await update(); } else { await update(); }
						}} class="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
							<input type="hidden" name="linkId" value={link.id} />
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="mb-1 block text-xs font-medium text-gray-600">Qty per booking</label>
									<input name="quantityPerBooking" type="number" min="1" value={link.quantityPerBooking}
										class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
								</div>
								<div class="flex items-center gap-2 self-end pb-1.5">
									<input id="inc_{link.id}" name="isIncluded" type="checkbox" value="true"
										checked={link.isIncluded} class="rounded border-gray-300 text-ocean" />
									<label for="inc_{link.id}" class="text-xs font-medium text-gray-600">Included in price</label>
								</div>
							</div>
							{#if !link.isIncluded}
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="mb-1 block text-xs font-medium text-gray-600">Add-on price (€)</label>
									<input name="addonPrice" type="number" step="0.01" min="0" value={link.addonPrice ?? ''}
										placeholder="0.00" class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
								</div>
								<div>
									<label class="mb-1 block text-xs font-medium text-gray-600">Pricing mode</label>
									<select name="addonPricingMode" class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
										<option value="">—</option>
										{#each PRICING_MODE_OPTIONS as opt}
											<option value={opt.value} selected={link.addonPricingMode === opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
								<div class="flex items-center gap-2 col-span-2">
									<input id="opt_{link.id}" name="isOptional" type="checkbox" value="true"
										checked={link.isOptional} class="rounded border-gray-300 text-ocean" />
									<label for="opt_{link.id}" class="text-xs font-medium text-gray-600">Optional (client can decline)</label>
								</div>
							</div>
							{/if}
							<div class="flex gap-2">
								<button type="submit" class="rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white">Save</button>
								<button type="button" onclick={() => editingLinkId = null} class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
							</div>
						</form>
						{/if}
					</li>
				{/each}
				</ul>
			{/if}

			{#if data.canEditServices}
				{#if data.allItemTypes.length > 0}
				<form method="POST" action="?/addInventoryLink" use:enhance class="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
					<p class="text-xs font-semibold text-gray-700">Link inventory type</p>
					<div class="grid grid-cols-2 gap-3">
						<div class="col-span-2">
							<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_detail_inventory_item_type()}</label>
							<select name="itemTypeId" required
								class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
								<option value="">—</option>
								{#each data.allItemTypes as t}
									<option value={t.id}>{t.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-600">{m.service_detail_inventory_qty_booking()}</label>
							<input name="quantityPerBooking" type="number" min="1" value="1"
								class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
						</div>
						<div class="flex items-center gap-2 self-end pb-1.5">
							<input id="newIsIncluded" name="isIncluded" type="checkbox" value="true" checked
								class="rounded border-gray-300 text-ocean" />
							<label for="newIsIncluded" class="text-xs font-medium text-gray-600">{m.service_detail_inventory_included_label()}</label>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-600">Add-on price (€) <span class="font-normal">(if not included)</span></label>
							<input name="addonPrice" type="number" step="0.01" min="0" placeholder="0.00"
								class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-600">Add-on pricing mode</label>
							<select name="addonPricingMode" class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
								<option value="">—</option>
								{#each PRICING_MODE_OPTIONS as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<input id="newIsOptional" name="isOptional" type="checkbox" value="true" checked
								class="rounded border-gray-300 text-ocean" />
							<label for="newIsOptional" class="text-xs font-medium text-gray-600">Optional add-on</label>
						</div>
						<button type="submit" class="rounded-lg bg-ocean px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean/90">
							{m.service_detail_inventory_btn_link()}
						</button>
					</div>
					{#if form?.linkError}<p class="text-xs text-red-600">{form?.linkError}</p>{/if}
				</form>
				{:else}
				<div class="border-t border-gray-100 p-4 text-sm text-gray-500">
					<a href="/inventory/new" class="text-ocean hover:underline">{m.service_detail_inventory_create_first()}</a> {m.service_detail_inventory_create_hint()}
				</div>
				{/if}
			{/if}
		</section>
		{/if}

		<!-- Runs (for date-range services) -->
		{#if data.service.modules?.editions && canEditServices}
			<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.service_detail_runs()}</h2>
				<p class="mb-3 text-xs text-muted">{m.service_detail_runs_desc()}</p>

				{#if form?.runError}
					<p class="mb-3 text-sm text-red-600">{form.runError}</p>
				{/if}

				{#if data.runs.length > 0}
					<div class="mb-4 space-y-2">
						{#each data.runs as run}
							<div class="flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-border">
								<div>
									<p class="text-sm font-medium text-gray-800">{run.startDate} → {run.endDate}</p>
									{#if run.maxCapacity}
										<p class="text-xs text-muted">{run.enrolledCount} / {run.maxCapacity} enrolled</p>
									{/if}
									{#if run.notes}
										<p class="text-xs text-muted">{run.notes}</p>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<a href="/bookings/camp/{data.service.id}?run={run.id}" class="text-xs text-ocean hover:underline">{m.service_detail_run_roster()}</a>
									{#if run.enrolledCount === 0}
										<form method="POST" action="?/deleteRun" use:enhance>
											<input type="hidden" name="runId" value={run.id} />
											<button
												type="submit"
												class="text-xs text-red-500 hover:underline"
												onclick={(e) => { if (!confirm(m.service_detail_run_delete_confirm())) e.preventDefault(); }}
											>{m.common_delete()}</button>
										</form>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="mb-3 text-xs text-muted">{m.service_detail_no_runs()}</p>
				{/if}

				<form method="POST" action="?/addRun" use:enhance class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-700">{m.service_detail_run_start()}</label>
							<input type="date" name="startDate" required class="input w-full" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-700">{m.service_detail_run_end()}</label>
							<input type="date" name="endDate" required class="input w-full" />
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-700">{m.service_detail_run_capacity()} <span class="text-muted">({m.common_optional()})</span></label>
							<input type="number" name="maxCapacity" min="1" class="input w-full" placeholder="10" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-700">{m.service_detail_run_notes()} <span class="text-muted">({m.common_optional()})</span></label>
							<input type="text" name="notes" class="input w-full" placeholder={m.service_detail_run_notes_placeholder()} />
						</div>
					</div>
					<button type="submit" class="btn-primary btn-sm">{m.service_detail_run_add()}</button>
				</form>
			</section>
		{/if}

		<!-- Global error (e.g. delete blocked) -->
		{#if form?.error && !editing}
			<p class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<!-- Actions -->
		<div class="flex flex-col gap-2">
			{#if data.service.modules?.roster && data.runs?.length > 0}
				<a href="/bookings/camp/{data.service.id}" class="btn-primary btn-block text-center">
					{m.service_detail_open_roster()}
				</a>
			{/if}
			{#if canEditServices}
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => {
					editModules = { ...data.service.modules };
					editing = true;
				}}
					class="btn-secondary flex-1"
				>{m.common_edit()}</button>
				<form method="post" action="?/toggle" use:enhance={serviceEnhance()}>
					<button type="submit" class="{data.service.active ? 'btn-ghost' : 'btn-ghost text-confirmed'}">
						{data.service.active ? m.service_detail_deactivate() : m.service_detail_activate()}
					</button>
				</form>
				<form method="post" action="?/delete" use:enhance={serviceEnhance()}
					onsubmit={(e) => { if (!confirm(m.service_detail_delete_confirm())) e.preventDefault(); }}>
					<button type="submit" class="btn-destructive">{m.common_delete()}</button>
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
			<!-- Hidden modules JSON (kept in sync with toggle UI below) -->
			<input type="hidden" name="modules" value={JSON.stringify(editModules)} />

			<div>
				<label class="label">Name *</label>
				<input name="name" required value={data.service.name} class="input" />
			</div>

			<div>
				<label class="label">{m.service_detail_edit_label()}</label>
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
				<p class="mt-1 text-xs text-muted">{m.service_detail_edit_label_hint()}</p>
			</div>

			<div>
				<label class="label">{m.service_detail_edit_color()}</label>
				<ColorPicker selected={data.service.color} />
			</div>

			<!-- Capabilities: active module cards + inactive chips -->
			<div>
				<p class="label mb-2">Capacidades</p>

				{#if activeEditModDefs.length > 0}
					<div class="space-y-2.5">
						{#each activeEditModDefs as mod (mod.key)}
							<div class="rounded-lg border-2 border-ocean/30 bg-ocean/5 p-3 space-y-2.5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-gray-900">{mod.icon} {mod.label}</span>
									<button type="button" onclick={() => deactivateEditModule(mod.key)}
										class="text-[10px] text-muted hover:text-red-500">✕ Quitar</button>
								</div>

								{#if mod.key === 'sessions'}
									<div class="grid grid-cols-2 gap-2">
										<div>
											<label class="mb-0.5 block text-xs text-muted">Duración (min)</label>
											<input name="durationMinutes" type="number" min="15" step="15"
												class="input" placeholder="90"
												value={data.service.durationMinutes ?? ''} />
										</div>
										{#if !editModules.roster}
											<div>
												<label class="mb-0.5 block text-xs text-muted">Sesiones incluidas</label>
												<input name="defaultSessionsIncluded" type="number" min="1"
													class="input" placeholder="1"
													value={data.service.defaultSessionsIncluded ?? ''} />
											</div>
										{/if}
									</div>
								{:else if mod.key === 'roster'}
									<div>
										<label class="mb-0.5 block text-xs text-muted">Capacidad máxima</label>
										<input name="maxCapacity" type="number" min="1" step="1" required
											class="input" placeholder="8"
											value={data.service.maxCapacity ?? ''} />
									</div>
								{:else if mod.key === 'inventory'}
									{#if !editModules.roster}
										<div>
											<label class="mb-0.5 block text-xs text-muted">Unidades disponibles</label>
											<input name="maxCapacity" type="number" min="1" step="1"
												class="input" placeholder="10"
												value={data.service.maxCapacity ?? ''} />
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
															checked={data.service.defaultInstructorIds?.includes(instructor.id) ?? false}
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
												value={(editModules as any).credits?.creditsIncluded ?? 5}
												oninput={(e) => {
													const v = parseInt((e.target as HTMLInputElement).value) || 5;
													editModules = { ...editModules, credits: { ...(editModules as any).credits, creditsIncluded: v, validityMode: (editModules as any).credits?.validityMode ?? 'season', compatibleServiceIds: [] } } as any;
												}} />
										</div>
										<div>
											<label class="mb-0.5 block text-xs text-muted">Validez</label>
											<select class="input"
												onchange={(e) => {
													editModules = { ...editModules, credits: { ...(editModules as any).credits, validityMode: (e.target as HTMLSelectElement).value, creditsIncluded: (editModules as any).credits?.creditsIncluded ?? 5, compatibleServiceIds: [] } } as any;
												}}>
												<option value="season" selected={(editModules as any).credits?.validityMode !== 'days'}>Temporada</option>
												<option value="days" selected={(editModules as any).credits?.validityMode === 'days'}>Días</option>
											</select>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if inactiveEditModDefs.length > 0}
					<div class="flex flex-wrap gap-2 pt-1">
						{#each inactiveEditModDefs as mod (mod.key)}
							<button type="button" onclick={() => activateEditModule(mod.key)}
								class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-ocean hover:text-ocean transition-colors">
								{mod.icon} {mod.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Pricing mode — applies to all service types -->
			<div>
				<label class="label">Pricing mode</label>
				<select name="pricingMode" class="input">
					<option value="">— none (manual) —</option>
					{#each PRICING_MODE_OPTIONS as opt}
						<option value={opt.value} selected={data.service.pricingMode === opt.value}>
							{opt.label} — {opt.hint}
						</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-muted">Determines how the price is auto-calculated from participants, sessions, or duration.</p>
			</div>

			{#if canEditServices}
			<div>
				<label class="label">{m.service_new_base_price()}</label>
				<input name="basePrice" type="number" step="0.01" min="0" required value={data.service.basePrice}
					class="input" />
			</div>
			{:else}
			<div>
				<label class="label">{m.service_new_base_price()}</label>
				<p class="text-sm text-muted">{m.service_detail_price_managed()}</p>
				<input type="hidden" name="basePrice" value={data.service.basePrice} />
			</div>
			{/if}

			<div>
				<label class="label">{m.common_description()}</label>
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
					{loading ? m.common_saving() : m.common_save_changes()}
				</button>
				<button type="button" onclick={() => editing = false} class="btn-secondary">
					{m.common_cancel()}
				</button>
			</div>
			{:else}
			<div class="flex gap-2">
				<button type="button" onclick={() => editing = false} class="btn-secondary flex-1">
					{m.common_cancel()}
				</button>
			</div>
			{/if}
		</form>
	{/if}
</div>
