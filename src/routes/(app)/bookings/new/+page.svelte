<script lang="ts">
	import { untrack } from 'svelte';
	import { Zap } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { PageData } from './$types';
	import type { ServiceEdition } from '$lib/features/services/editions.types';
	import NotesSection from '$lib/components/bookings/sections/NotesSection.svelte';
	import ClientSearchInput from '$lib/components/ClientSearchInput.svelte';

	let { data }: { data: PageData } = $props();
	let loading = $state(false);

	// ── Service selection ─────────────────────────────────────────────────────
	let selectedServiceId = $state(data.defaultServiceId || (data.services[0]?.id ?? ''));
	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));
	const modules = $derived(selectedService?.modules ?? {});

	// ── Module flags ──────────────────────────────────────────────────────────
	const hasEditions    = $derived('editions' in modules);
	const hasSessions    = $derived('sessions' in modules);
	const hasInventory   = $derived('inventory' in modules);
	const hasInstructor  = $derived('instructor' in modules);
	const hasCredits     = $derived('credits' in modules);

	// Sessions: date is set per-session on the detail page — no date field here
	// Editions: date comes from the edition — no date field here
	// Simple services: show date (and time if no sessions)
	const showDateField = $derived(!hasSessions && !hasEditions);
	const showTimeField = $derived(!hasSessions && !hasEditions && !hasInventory);
	const showInstructor = $derived(hasInstructor && !hasSessions);

	// ── Credits pack quantity ─────────────────────────────────────────────────
	let packQuantity = $state(1);
	$effect(() => { if (!hasCredits) packQuantity = 1; });

	// ── Editions ──────────────────────────────────────────────────────────────
	let editions = $state<ServiceEdition[]>(
		selectedServiceId ? (data.editionsByService[selectedServiceId] ?? []) : []
	);
	let editionsLoading = $state(false);
	let selectedEditionId = $state(data.defaultEditionId ?? '');
	const selectedEdition = $derived(editions.find((e) => e.id === selectedEditionId));

	let _serviceInitialized = false;
	$effect(() => {
		const svcId = selectedServiceId;
		untrack(() => {
			if (!_serviceInitialized) { _serviceInitialized = true; return; }
			selectedEditionId = '';
			if (!svcId) { editions = []; return; }
			editionsLoading = true;
			fetch(`/bookings/new?serviceId=${svcId}`)
				.then(r => r.json())
				.then((eds: ServiceEdition[]) => { editions = eds; editionsLoading = false; })
				.catch(() => { editionsLoading = false; });
		});
	});

	// ── Dates ─────────────────────────────────────────────────────────────────
	const today = new Date().toISOString().slice(0, 10);
	let date = $state(data.defaultDate ?? today);
	let time = $state(data.defaultTime ?? '');
	let isFlexible = $state((data.defaultTime ?? '') === '');
	let invCheckIn = $state('');
	let invCheckOut = $state('');

	// Inventory date-range pricing
	const inventoryPricingMode = $derived(selectedService?.pricingMode ?? null);
	const inventoryNeedsDateRange = $derived(
		inventoryPricingMode === 'per_night' ||
		inventoryPricingMode === 'per_day'   ||
		inventoryPricingMode === 'per_unit_per_day' ||
		inventoryPricingMode === 'per_person_per_day'
	);
	function calcInventoryUnits(): number {
		if (!inventoryNeedsDateRange || !invCheckIn || !invCheckOut) return 1;
		const diff = Math.round(
			(new Date(invCheckOut).getTime() - new Date(invCheckIn).getTime()) / 86_400_000
		);
		return Math.max(1, diff);
	}
	const invCalculatedAmount = $derived(
		invCheckIn && invCheckOut && inventoryNeedsDateRange
			? (parseFloat(selectedService?.basePrice ?? '0') * calcInventoryUnits()).toFixed(2)
			: (selectedService?.basePrice ?? '0')
	);

	// ── Client (single, contract holder) ─────────────────────────────────────
	let selectedClient = $state<{ clientId: string; name: string } | null>(null);

	// ── Participants ──────────────────────────────────────────────────────────
	let participantCount = $state(1);
	let clientAlsoParticipates = $state(true);

	// ── Notes ─────────────────────────────────────────────────────────────────
	let notesOpen = $state(false);
	let spotNotes = $state('');
	let notes = $state('');

	// amountDue calculation
	function calcAmountDue(): string {
		if (hasInventory && inventoryNeedsDateRange) return invCalculatedAmount;
		if (hasCredits && packQuantity > 1)
			return (parseFloat(selectedService?.basePrice ?? '0') * packQuantity).toFixed(2);
		return selectedService?.basePrice ?? '0';
	}

	// Keep inventory amount in sync when dates change
	$effect(() => {
		// reactive deps
		const _amt = invCalculatedAmount;
		// no-op: amount is read at submit time via calcAmountDue()
		void _amt;
	});
</script>

<div class="mx-auto max-w-xl p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">Nueva reserva</h1>
	</div>

	<form
		method="post"
		class="space-y-3"
		use:enhance={() => {
			loading = true;
			return async ({ result, update }) => {
				loading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as { bookingId?: string; multiDay?: boolean; date?: string; message?: string };
					toast(d.message ?? 'Reserva creada');
					if (d.multiDay) await goto(`/calendar?date=${d.date}`);
					else if (d.bookingId) await goto(`/bookings/${d.bookingId}?new=1`);
				} else if (result.type === 'failure') {
					if ((result.data as { error?: string })?.error)
						toast((result.data as { error: string }).error, 'error');
					await update();
				} else {
					await update();
				}
			};
		}}
	>
		<!-- ── SERVICE + SCHEDULING ────────────────────────────────────────────── -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-4">
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Servicio</label>
				<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
					{#each data.services as s (s.id)}
						<option value={s.id}>{s.name} — €{s.basePrice}</option>
					{/each}
				</select>
			</div>

			<!-- Edition picker -->
			{#if hasEditions}
				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Edición</label>
					{#if editionsLoading}
						<div class="flex items-center gap-2 rounded-lg border border-border bg-sand px-3 py-2 text-xs text-muted">
							<span class="animate-spin">⟳</span> Cargando ediciones…
						</div>
					{:else if editions.length > 0}
						<select name="serviceEditionId" bind:value={selectedEditionId} required class="input w-full">
							<option value="">Seleccionar edición...</option>
							{#each editions as ed (ed.id)}
								<option value={ed.id} disabled={!ed.active}>
									{ed.startDate} → {ed.endDate}{ed.maxCapacity ? ` (${ed.enrolledCount ?? 0}/${ed.maxCapacity})` : ''}{ed.notes ? ` · ${ed.notes}` : ''}
								</option>
							{/each}
						</select>
						{#if selectedEdition}
							<div class="mt-1 flex items-center justify-between rounded-lg bg-ocean/5 px-3 py-2 text-xs text-muted">
								<span>📅 {selectedEdition.startDate} → {selectedEdition.endDate}
									{#if selectedEdition.maxCapacity}· {selectedEdition.enrolledCount ?? 0}/{selectedEdition.maxCapacity} plazas{/if}
								</span>
							</div>
							<input type="hidden" name="date" value={selectedEdition.startDate} />
							<input type="hidden" name="dateEnd" value={selectedEdition.endDate} />
						{:else}
							<p class="mt-1 text-xs text-amber-600">Selecciona una edición para continuar</p>
						{/if}
					{:else}
						<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
							Sin ediciones disponibles. <a href="/services/{selectedService?.id}" class="underline">Añadir edición</a>
						</p>
					{/if}
				</div>

			<!-- Inventory: check-in / check-out -->
			{:else if hasInventory && inventoryNeedsDateRange}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Check-in</label>
						<input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
					</div>
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Check-out</label>
						<input name="dateEnd" type="date" required bind:value={invCheckOut} class="input w-full" />
					</div>
				</div>
				{#if invCheckIn && invCheckOut && invCheckIn < invCheckOut}
					<div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 text-sm">
						<span class="text-gray-600">{calcInventoryUnits()} {inventoryPricingMode === 'per_night' ? 'noches' : 'días'} × €{selectedService?.basePrice}</span>
						<span class="ml-auto font-semibold text-gray-900">= €{invCalculatedAmount}</span>
					</div>
				{/if}

			<!-- Simple inventory (no date-range pricing) -->
			{:else if hasInventory}
				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Fecha</label>
					<input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
				</div>

			<!-- Sessions: date auto = today, scheduled per-session from detail page -->
			{:else if hasSessions}
				<input type="hidden" name="date" value={today} />
				<input type="hidden" name="isFlexible" value="on" />
				<p class="text-xs text-muted rounded-lg bg-sand px-3 py-2">
					📅 Las fechas se configuran sesión a sesión desde el detalle de reserva.
				</p>

			<!-- Default: date + optional time -->
			{:else}
				<div class="{showTimeField ? 'grid grid-cols-2 gap-3' : ''}">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Fecha</label>
						<input type="date" name="date" bind:value={date} required class="input w-full" />
					</div>
					{#if showTimeField}
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Hora</label>
							<input type="time" name="time" bind:value={time} disabled={isFlexible} class="input w-full disabled:opacity-40" />
						</div>
					{/if}
				</div>
				{#if showTimeField}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
						<input type="checkbox" name="isFlexible" bind:checked={isFlexible} class="h-4 w-4 accent-ocean" />
						<div>
							<p class="flex items-center gap-1.5 text-sm font-medium text-gray-800"><Zap size={14} /> Horario flexible</p>
							<p class="text-xs text-muted">Se confirmará más tarde</p>
						</div>
					</label>
				{/if}
				{#if showInstructor}
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Instructor</label>
						<select name="instructorId" class="input w-full">
							<option value="">Sin asignar</option>
							{#each data.instructors as inst (inst.id)}
								<option value={inst.id}>{inst.name}</option>
							{/each}
						</select>
					</div>
				{/if}
			{/if}
		</div>

		<!-- ── CREDITS PACK QUANTITY ─────────────────────────────────────────────── -->
		{#if hasCredits}
			<input type="hidden" name="quantity" value={packQuantity} />
			<div class="rounded-(--radius-card) bg-purple-50 p-4 ring-1 ring-purple-200 space-y-2">
				<p class="text-xs font-semibold uppercase tracking-wide text-purple-700">🎟 Bonos a comprar</p>
				<div class="flex items-center gap-3">
					<button type="button" onclick={() => packQuantity = Math.max(1, packQuantity - 1)}
						class="flex h-8 w-8 items-center justify-center rounded-full border border-purple-300 text-sm text-purple-700 hover:bg-purple-100">−</button>
					<span class="w-8 text-center text-lg font-bold text-purple-800">{packQuantity}</span>
					<button type="button" onclick={() => packQuantity = packQuantity + 1}
						class="flex h-8 w-8 items-center justify-center rounded-full border border-purple-300 text-sm text-purple-700 hover:bg-purple-100">+</button>
					<span class="text-xs text-purple-600">
						{packQuantity > 1 ? `${packQuantity}× €${selectedService?.basePrice} = €${(parseFloat(selectedService?.basePrice ?? '0') * packQuantity).toFixed(2)}` : `€${selectedService?.basePrice}`}
					</span>
				</div>
			</div>
		{/if}

		<!-- ── CLIENT + PARTICIPANTS ─────────────────────────────────────────────── -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-4">

			<!-- Contract holder -->
			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cliente (titular)</p>
				{#if selectedClient}
					<input type="hidden" name="clientId" value={selectedClient.clientId} />
					<input type="hidden" name="clientName" value={selectedClient.name} />
					<input type="hidden" name="amountDue" value={calcAmountDue()} />
					<input type="hidden" name="participantCount" value={participantCount} />
					<input type="hidden" name="alsoParticipates" value={clientAlsoParticipates ? 'true' : 'false'} />
					<div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2.5 ring-1 ring-ocean/20">
						<span class="flex-1 font-medium text-ocean">{selectedClient.name}</span>
						<button type="button" onclick={() => { selectedClient = null; participantCount = 1; clientAlsoParticipates = true; }}
							class="text-ocean/40 hover:text-red-400">✕</button>
					</div>
				{:else}
					<ClientSearchInput
						clients={data.clients}
						excludeIds={[]}
						placeholder="Buscar cliente..."
						onSelect={(c) => {
							selectedClient = { clientId: c.id, name: `${c.firstName} ${c.lastName}`.trim() };
						}}
					/>
				{/if}
			</div>

			<!-- Participants (only if relevant) -->
			{#if selectedClient && (hasSessions || 'roster' in modules)}
				<div class="border-t border-border pt-3">
					<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Participantes</p>
					<div class="space-y-3">
						<!-- Count -->
						<div class="flex items-center gap-3">
							<span class="text-sm text-gray-700">¿Cuántas personas?</span>
							<button type="button" onclick={() => participantCount = Math.max(1, participantCount - 1)}
								class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm hover:bg-gray-100">−</button>
							<span class="w-6 text-center font-bold text-gray-900">{participantCount}</span>
							<button type="button" onclick={() => participantCount = participantCount + 1}
								class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm hover:bg-gray-100">+</button>
						</div>
						<!-- Client participates -->
						<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
							<input type="checkbox" bind:checked={clientAlsoParticipates} class="h-4 w-4 accent-ocean" />
							El titular también participa (usar su nombre como participante)
						</label>
						<p class="text-[11px] text-muted">Los nombres específicos se añaden desde el detalle de la reserva.</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- ── NOTES ─────────────────────────────────────────────────────────────── -->
		<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
			<button type="button" onclick={() => notesOpen = !notesOpen}
				class="flex w-full items-center justify-between px-4 py-3 text-left">
				<span class="text-xs font-semibold uppercase tracking-wide text-muted">Notas</span>
				<svg class="h-4 w-4 text-muted transition-transform {notesOpen ? 'rotate-90' : ''}"
					fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</button>
			{#if notesOpen}
				<div class="border-t border-border px-4 pb-4 pt-3">
					<NotesSection bind:spotNotes bind:notes />
				</div>
			{/if}
		</div>

		<button type="submit" disabled={loading || !selectedClient}
			class="btn-primary btn-block mt-2">
			{loading ? 'Guardando...' : 'Crear reserva'}
		</button>
	</form>
</div>
