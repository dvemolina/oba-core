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

	// ── Module flags (pure module checks, no type names) ──────────────────────
	const hasEditions = $derived('editions' in modules);
	const hasRoster = $derived('roster' in modules);
	const hasSessions = $derived('sessions' in modules);
	const hasInventory = $derived('inventory' in modules);
	const hasInstructor = $derived('instructor' in modules);
	const hasCredits = $derived('credits' in modules);
	const needsParticipantCount = $derived(hasRoster || hasSessions);

	// ── Credits pack quantity ─────────────────────────────────────────────────
	let packQuantity = $state(1);
	$effect(() => { if (!hasCredits) packQuantity = 1; });

	// ── UX flags ──────────────────────────────────────────────────────────────
	const showEditionPicker = $derived(hasEditions);
	const showDateRange = $derived(hasInventory && !hasEditions && !hasSessions);
	const showInstructor = $derived(hasInstructor && !hasSessions);

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
	let date = $state(data.defaultDate ?? '');
	let time = $state(data.defaultTime ?? '');
	let isFlexible = $state((data.defaultTime ?? '') === '');
	let invCheckIn = $state('');
	let invCheckOut = $state('');

	// Inventory date-range pricing
	const inventoryPricingMode = $derived(selectedService?.pricingMode ?? null);
	const inventoryNeedsDateRange = $derived(
		inventoryPricingMode === 'per_night' ||
			inventoryPricingMode === 'per_day' ||
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

	// ── Instructor ────────────────────────────────────────────────────────────
	let instructorId = $state('');

	// ── Notes ─────────────────────────────────────────────────────────────────
	let notesOpen = $state(false);
	let spotNotes = $state('');
	let notes = $state('');

	// ── Clients ───────────────────────────────────────────────────────────────
	let selectedClients = $state<
		Array<{
			clientId: string;
			name: string;
			amountDue: string;
			participantCount: number;
			alsoParticipates: boolean;
		}>
	>([]);

	function calcAmountDue(): string {
		if (showDateRange) return invCalculatedAmount;
		if (hasCredits && packQuantity > 1)
			return (parseFloat(selectedService?.basePrice ?? '0') * packQuantity).toFixed(2);
		return selectedService?.basePrice ?? '0';
	}

	function addClient(client: { id: string; firstName: string; lastName: string }) {
		if (selectedClients.some((c) => c.clientId === client.id)) return;
		selectedClients = [
			...selectedClients,
			{
				clientId: client.id,
				name: `${client.firstName} ${client.lastName}`.trim(),
				amountDue: calcAmountDue(),
				participantCount: 1,
				alsoParticipates: false
			}
		];
	}
	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}

	// Keep inventory client amounts in sync when dates change
	$effect(() => {
		if (showDateRange) {
			const amt = invCalculatedAmount;
			untrack(() => {
				selectedClients = selectedClients.map((c) => ({ ...c, amountDue: amt }));
			});
		}
	});

	// Keep credits client amounts in sync when pack quantity changes
	$effect(() => {
		if (hasCredits) {
			const qty = packQuantity;
			const base = selectedService?.basePrice ?? '0';
			const amt = qty > 1 ? (parseFloat(base) * qty).toFixed(2) : base;
			untrack(() => {
				selectedClients = selectedClients.map((c) => ({ ...c, amountDue: amt }));
			});
		}
	});
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a
			href="/calendar"
			class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a
		>
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
					const d = result.data as {
						bookingId?: string;
						multiDay?: boolean;
						date?: string;
						message?: string;
					};
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
		<!-- Service selector -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-4">
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
					>Servicio</label
				>
				<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
					{#each data.services as s (s.id)}
						<option value={s.id}>{s.name} — €{s.basePrice}</option>
					{/each}
				</select>
			</div>

			<!-- Date section: driven by modules -->
			{#if showEditionPicker}
				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
						>Edición</label
					>
					{#if editionsLoading}
						<div class="flex items-center gap-2 rounded-lg border border-border bg-sand px-3 py-2 text-xs text-muted">
							<span class="animate-spin">⟳</span> Cargando ediciones…
						</div>
					{:else if editions.length > 0}
						<select
							name="serviceEditionId"
							bind:value={selectedEditionId}
							required
							class="input w-full"
						>
							<option value="">Seleccionar edición...</option>
							{#each editions as ed (ed.id)}
								<option value={ed.id} disabled={!ed.active}>
									{ed.startDate} → {ed.endDate}{ed.maxCapacity
										? ` (${ed.enrolledCount ?? 0}/${ed.maxCapacity})`
										: ''}{ed.notes ? ` · ${ed.notes}` : ''}
								</option>
							{/each}
						</select>
						{#if selectedEdition}
							<div class="mt-1 flex items-center justify-between rounded-lg bg-ocean/5 px-3 py-2 text-xs text-muted">
								<span>
									📅 {selectedEdition.startDate} → {selectedEdition.endDate}
									{#if selectedEdition.maxCapacity}
										· {selectedEdition.enrolledCount ?? 0}/{selectedEdition.maxCapacity} plazas
									{/if}
								</span>
							</div>
							<input type="hidden" name="date" value={selectedEdition.startDate} />
							<input type="hidden" name="dateEnd" value={selectedEdition.endDate} />
						{:else}
							<p class="mt-1 text-xs text-amber-600">Selecciona una edición para continuar</p>
						{/if}
					{:else}
						<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
							Sin ediciones disponibles.
							<a href="/services/{selectedService?.id}" class="underline">Añadir edición</a>
						</p>
					{/if}
				</div>
			{:else if showDateRange}
				{#if inventoryNeedsDateRange}
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label
								class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
								>Check-in</label
							>
							<input
								name="date"
								type="date"
								required
								bind:value={invCheckIn}
								class="input w-full"
							/>
						</div>
						<div>
							<label
								class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
								>Check-out</label
							>
							<input
								name="dateEnd"
								type="date"
								required
								bind:value={invCheckOut}
								class="input w-full"
							/>
						</div>
					</div>
					{#if invCheckIn && invCheckOut && invCheckIn < invCheckOut}
						<div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 text-sm">
							<span class="text-gray-600"
								>{calcInventoryUnits()}
								{inventoryPricingMode === 'per_night' ? 'noches' : 'días'} × €{selectedService?.basePrice}</span
							>
							<span class="ml-auto font-semibold text-gray-900">= €{invCalculatedAmount}</span>
						</div>
					{/if}
				{:else}
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
							>Fecha</label
						>
						<input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
					</div>
				{/if}
			{:else}
				<!-- Default: date (+ time only for non-session services) -->
				<div class="{hasSessions ? '' : 'grid grid-cols-2 gap-3'}">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
							>Fecha</label
						>
						<input type="date" name="date" bind:value={date} required class="input w-full" />
					</div>
					{#if !hasSessions}
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
							>Hora</label
						>
						<input
							type="time"
							name="time"
							bind:value={time}
							disabled={isFlexible}
							class="input w-full disabled:opacity-40"
						/>
					</div>
					{/if}
				</div>
				{#if !hasSessions}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
						<input
							type="checkbox"
							name="isFlexible"
							bind:checked={isFlexible}
							class="h-4 w-4 accent-ocean"
						/>
						<div>
							<p class="flex items-center gap-1.5 text-sm font-medium text-gray-800">
								<Zap size={14} /> Horario flexible
							</p>
							<p class="text-xs text-muted">Se confirmará más tarde</p>
						</div>
					</label>
				{/if}
				{#if showInstructor}
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
							>Instructor</label
						>
						<select name="instructorId" bind:value={instructorId} class="input w-full">
							<option value="">Sin asignar</option>
							{#each data.instructors as inst (inst.id)}
								<option value={inst.id}>{inst.name}</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if hasSessions}
					<p class="text-xs text-muted">Las sesiones se programan desde el detalle de reserva.</p>
					<input type="hidden" name="isFlexible" value="on" />
				{/if}
			{/if}
		</div>

		<!-- Credits pack quantity (only for credits services) -->
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

		<!-- Clients section -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-2">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted">Clientes</p>

			{#each selectedClients as c (c.clientId)}
				<input type="hidden" name="clientId" value={c.clientId} />
				<input type="hidden" name="clientName" value={c.name} />
				<input type="hidden" name="amountDue" value={c.amountDue} />
				<input type="hidden" name="participantCount" value={c.participantCount} />
				<input type="hidden" name="alsoParticipates" value={c.alsoParticipates ? 'true' : 'false'} />
			{/each}

			{#if selectedClients.length > 0}
				<div class="space-y-2">
					{#each selectedClients as c, i (c.clientId)}
						<div
							class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 ring-1 ring-ocean/20"
						>
							<span class="flex-1 text-sm font-medium text-ocean">{c.name}</span>
							{#if needsParticipantCount}
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() =>
											(selectedClients[i].participantCount = Math.max(
												1,
												c.participantCount - 1
											))}
										class="h-5 w-5 rounded-full border border-ocean/30 text-center text-xs text-ocean hover:bg-ocean/10"
										>−</button
									>
									<span class="w-5 text-center text-xs font-semibold text-ocean"
										>{c.participantCount}</span
									>
									<button
										type="button"
										onclick={() =>
											(selectedClients[i].participantCount = c.participantCount + 1)}
										class="h-5 w-5 rounded-full border border-ocean/30 text-center text-xs text-ocean hover:bg-ocean/10"
										>+</button
									>
								</div>
								<label class="flex items-center gap-1 text-[10px] text-muted cursor-pointer">
									<input
										type="checkbox"
										bind:checked={selectedClients[i].alsoParticipates}
										class="h-3 w-3 accent-ocean"
									/>
									también participa
								</label>
							{/if}
							<button
								type="button"
								onclick={() => removeClient(c.clientId)}
								class="ml-1 text-ocean/40 hover:text-ocean">✕</button
							>
						</div>
					{/each}
				</div>
			{/if}

			<ClientSearchInput
				clients={data.clients}
				excludeIds={selectedClients.map((c) => c.clientId)}
				placeholder="Buscar cliente..."
				onSelect={(c) => addClient({ id: c.id, firstName: c.firstName, lastName: c.lastName })}
			/>
		</div>

		<!-- Notes (collapsed) -->
		<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
				<button
					type="button"
					onclick={() => (notesOpen = !notesOpen)}
					class="flex w-full items-center justify-between px-4 py-3 text-left"
				>
					<span class="text-xs font-semibold uppercase tracking-wide text-muted">Notas</span>
					<svg
						class="h-4 w-4 text-muted transition-transform {notesOpen ? 'rotate-90' : ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
				{#if notesOpen}
					<div class="border-t border-border px-4 pb-4 pt-3">
						<NotesSection bind:spotNotes bind:notes />
					</div>
				{/if}
			</div>

		<button
			type="submit"
			disabled={loading || selectedClients.length === 0}
			class="btn-primary btn-block mt-2"
		>
			{loading ? 'Guardando...' : 'Crear reserva'}
		</button>
	</form>
</div>
