<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let isFlexible = $state(untrack(() => data.defaultTime === ''));
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let clientSearch = $state('');
	let selectedUnitTypeId = $state('');

	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));
	const isCamp = $derived(selectedService?.hasRoster);
	const isLesson = $derived(selectedService?.hasSessions);
	const isAccommodation = $derived(selectedService?.hasInventoryUnits);
	const showInstructor = $derived(isLesson);
	const showTimeAndFlexible = $derived(isLesson);

	const unitTypes = $derived(
		isAccommodation ? (data.unitTypesByService[selectedServiceId] ?? []) : []
	);
	const selectedUnitType = $derived(unitTypes.find((ut) => ut.id === selectedUnitTypeId));

	// Auto-select first unit type when accommodation service chosen
	$effect(() => {
		if (isAccommodation && unitTypes.length > 0 && !selectedUnitTypeId) {
			selectedUnitTypeId = unitTypes[0].id;
		}
		if (!isAccommodation) selectedUnitTypeId = '';
	});

	const filteredClients = $derived(
		clientSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) &&
						!selectedClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);

	function addClient(client: (typeof data.clients)[0]) {
		const price = isAccommodation
			? (selectedUnitType?.pricePerNight ?? selectedService?.basePrice ?? '0')
			: (selectedService?.basePrice ?? '0');
		selectedClients = [
			...selectedClients,
			{ clientId: client.id, name: `${client.firstName} ${client.lastName}`, amountDue: price }
		];
		clientSearch = '';
	}

	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}

	// Inline new-client mini-form
	let newClientPanel = $state(false);
	let newFirstName = $state('');
	let newLastName = $state('');
	let newPhone = $state('');
	let newEmail = $state('');
	let creatingClient = $state(false);

	function openNewClientPanel() {
		const parts = clientSearch.trim().split(/\s+/);
		newFirstName = parts[0] ?? '';
		newLastName = parts.slice(1).join(' ');
		newPhone = '';
		newEmail = '';
		newClientPanel = true;
		clientSearch = '';
	}

	async function saveNewClient() {
		if (!newFirstName) return;
		creatingClient = true;
		try {
			const res = await fetch('/api/v1/clients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstName: newFirstName,
					lastName: newLastName || '—',
					phone: newPhone || undefined,
					email: newEmail || undefined
				})
			});
			const { data: client } = await res.json();
			selectedClients = [
				...selectedClients,
				{
					clientId: client.id,
					name: `${client.firstName} ${client.lastName !== '—' ? ' ' + client.lastName : ''}`.trim(),
					amountDue: selectedService?.basePrice ?? '0'
				}
			];
			newClientPanel = false;
		} finally {
			creatingClient = false;
		}
	}

	const showCreateNew = $derived(
		clientSearch.length > 1 && filteredClients.length === 0 && !newClientPanel
	);

	// Multi-day repeater (lessons only)
	let multiDay = $state(false);
	let extraDays = $state<Array<{ date: string; time: string }>>([]);

	function addExtraDay() {
		const last = extraDays[extraDays.length - 1];
		let nextDate = '';
		if (last?.date) {
			const d = new Date(last.date + 'T00:00:00');
			d.setDate(d.getDate() + 1);
			nextDate = d.toISOString().slice(0, 10);
		}
		extraDays = [...extraDays, { date: nextDate, time: last?.time ?? '' }];
	}

	function removeExtraDay(i: number) {
		extraDays = extraDays.filter((_, idx) => idx !== i);
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">
			{isCamp ? 'Enroll in Camp' : 'New Booking'}
		</h1>
	</div>

	<form
		method="post"
		class="space-y-5"
		use:enhance={() => {
			loading = true;
			return async ({ result, update }) => {
				loading = false;
				if (result.type === 'success' && result.data) {
					const data = result.data as { bookingId?: string; multiDay?: boolean; date?: string; message?: string };
					toast(data.message ?? 'Done');
					if (data.multiDay) await goto(`/calendar?date=${data.date}`);
					else if (data.bookingId) await goto(`/bookings/${data.bookingId}`);
				} else {
					await update();
				}
			};
		}}
	>
		<!-- Service -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Service *</label>
			<select
				name="serviceId"
				bind:value={selectedServiceId}
				required
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				{#each data.services as service}
					<option value={service.id}>{service.name} — €{service.basePrice}</option>
				{/each}
			</select>
		</div>

		{#if isCamp}
			<!-- ── CAMP ENROLL MODE ─────────────────────────────────── -->
			{#if selectedService?.startDate}
				<div class="rounded-lg bg-ocean/8 px-4 py-3 text-sm text-gray-700 ring-1 ring-ocean/20">
					<p class="font-semibold text-navy">🏕️ {selectedService.name}</p>
					<p class="mt-0.5 text-xs text-muted">
						{selectedService.startDate} → {selectedService.endDate}
						{#if selectedService.maxCapacity}· {selectedService.maxCapacity} slots max{/if}
					</p>
				</div>
			{/if}

			<!-- Client search (same component, reused) -->
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Enroll client *</label>

				{#if selectedClients.length > 0}
					<div class="mb-2 flex flex-wrap gap-2">
						{#each selectedClients as c}
							<div class="flex items-center gap-1 rounded-full bg-ocean/10 py-1 pl-3 pr-1">
								<span class="text-xs font-medium text-ocean">{c.name}</span>
								<input type="hidden" name="clientId" value={c.clientId} />
								<input type="hidden" name="amountDue" value={c.amountDue} />
								<button type="button" onclick={() => removeClient(c.clientId)}
									class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-ocean/60 hover:text-ocean">✕</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if !newClientPanel}
					<div class="relative">
						<input type="text" placeholder="Search client…" bind:value={clientSearch}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
						{#if filteredClients.length > 0 || showCreateNew}
							<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
								{#each filteredClients.slice(0, 6) as client}
									<button type="button" onclick={() => addClient(client)}
										class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
										{client.firstName} {client.lastName}
										{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
									</button>
								{/each}
								{#if showCreateNew}
									<button type="button" onclick={openNewClientPanel}
										class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
										+ Create "<span class="font-medium">{clientSearch}</span>"
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
						<p class="text-xs font-semibold text-ocean">New client</p>
						<div class="grid grid-cols-2 gap-2">
							<input bind:value={newFirstName} placeholder="First name *"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<input bind:value={newLastName} placeholder="Last name"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						</div>
						<input bind:value={newPhone} type="tel" placeholder="Phone"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<input bind:value={newEmail} type="email" placeholder="Email"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<div class="flex gap-2 pt-1">
							<button type="button" onclick={saveNewClient} disabled={!newFirstName || creatingClient}
								class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
								{creatingClient ? 'Saving…' : 'Add client'}
							</button>
							<button type="button" onclick={() => { newClientPanel = false; clientSearch = ''; }}
								class="btn-ghost btn-sm">Cancel</button>
						</div>
					</div>
				{/if}
			</div>

		{:else if isAccommodation}
			<!-- ── ACCOMMODATION MODE ────────────────────────────────── -->

			{#if unitTypes.length === 0}
				<div class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 ring-1 ring-amber-200">
					No unit types configured for this property. Add them in the service settings first.
				</div>
			{:else}
				<!-- Unit type selector -->
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Unit type *</label>
					<div class="space-y-2">
						{#each unitTypes as ut}
							<label class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors
								{selectedUnitTypeId === ut.id ? 'border-ocean bg-ocean/5' : 'border-border bg-surface hover:bg-sand'}">
								<input type="radio" name="accommodationUnitTypeId" value={ut.id}
									bind:group={selectedUnitTypeId} class="accent-ocean" />
								<div class="flex-1">
									<p class="text-sm font-medium text-gray-800">{ut.name}</p>
									<p class="text-xs text-muted">max {ut.maxOccupancy} guests · €{ut.pricePerNight}/night</p>
								</div>
								<span class="text-xs font-semibold text-ocean">€{ut.pricePerNight}</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Check-in / check-out -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Check-in *</label>
						<input name="date" type="date" required value={data.defaultDate}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Check-out *</label>
						<input name="dateEnd" type="date" required
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
					</div>
				</div>

				<!-- Guests count -->
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Guests</label>
					<input name="guestsCount" type="number" min="1"
						max={selectedUnitType?.maxOccupancy ?? 99}
						value="1"
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
				</div>

				<!-- Clients (guest names linked to booking) -->
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Guests / clients *</label>

					{#if selectedClients.length > 0}
						<div class="mb-2 flex flex-wrap gap-2">
							{#each selectedClients as c}
								<div class="flex items-center gap-1 rounded-full bg-ocean/10 py-1 pl-3 pr-1">
									<span class="text-xs font-medium text-ocean">{c.name}</span>
									<input type="hidden" name="clientId" value={c.clientId} />
									<input type="hidden" name="amountDue" value={c.amountDue} />
									<button type="button" onclick={() => removeClient(c.clientId)}
										class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-ocean/60 hover:text-ocean">✕</button>
								</div>
							{/each}
						</div>
					{/if}

					{#if !newClientPanel}
						<div class="relative">
							<input type="text" placeholder="Search client…" bind:value={clientSearch}
								class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
							{#if filteredClients.length > 0 || showCreateNew}
								<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
									{#each filteredClients.slice(0, 6) as client}
										<button type="button" onclick={() => addClient(client)}
											class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
											{client.firstName} {client.lastName}
											{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
										</button>
									{/each}
									{#if showCreateNew}
										<button type="button" onclick={openNewClientPanel}
											class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
											+ Create "<span class="font-medium">{clientSearch}</span>"
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
							<p class="text-xs font-semibold text-ocean">New client</p>
							<div class="grid grid-cols-2 gap-2">
								<input bind:value={newFirstName} placeholder="First name *"
									class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
								<input bind:value={newLastName} placeholder="Last name"
									class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							</div>
							<input bind:value={newPhone} type="tel" placeholder="Phone"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<input bind:value={newEmail} type="email" placeholder="Email"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<div class="flex gap-2 pt-1">
								<button type="button" onclick={saveNewClient} disabled={!newFirstName || creatingClient}
									class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
									{creatingClient ? 'Saving…' : 'Add client'}
								</button>
								<button type="button" onclick={() => { newClientPanel = false; clientSearch = ''; }}
									class="btn-ghost btn-sm">Cancel</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

		{:else}
			<!-- ── REGULAR BOOKING MODE ─────────────────────────────── -->

			<!-- Camp: fixed date info + hidden inputs -->
			{#if selectedService?.startDate}
				<div class="rounded-lg bg-sand/60 px-4 py-3 text-sm text-gray-700">
					🏕️ Camp dates: <strong>{selectedService.startDate}</strong> → <strong>{selectedService.endDate}</strong>
					{#if selectedService.maxCapacity}· Max {selectedService.maxCapacity} students{/if}
				</div>
				<input type="hidden" name="date" value={selectedService.startDate} />
				<input type="hidden" name="dateEnd" value={selectedService.endDate ?? ''} />
			{:else}
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700">Date *</label>
						<input name="date" type="date" required value={data.defaultDate}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
					</div>
					{#if showTimeAndFlexible}
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700">Time</label>
							<input name="time" type="time" value={data.defaultTime} disabled={isFlexible}
								class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
						</div>
					{/if}
				</div>
			{/if}

			{#if showTimeAndFlexible}
				<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
					<input type="checkbox" name="isFlexible" bind:checked={isFlexible} class="h-4 w-4 accent-ocean" />
					<div>
						<p class="text-sm font-medium text-gray-800">⚡ Flexible time</p>
						<p class="text-xs text-muted">Confirm based on surf conditions</p>
					</div>
				</label>

				<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-sand/60 p-3">
					<input type="checkbox" bind:checked={multiDay}
						onchange={() => { if (!multiDay) extraDays = []; }} class="h-4 w-4 accent-ocean" />
					<div>
						<p class="text-sm font-medium text-gray-800">📅 Repeat on more days</p>
						<p class="text-xs text-muted">Creates one booking per day, same clients</p>
					</div>
				</label>

				{#if multiDay}
					<div class="space-y-2 rounded-lg border border-border p-3">
						<p class="text-xs font-semibold text-muted uppercase tracking-wide">Additional days</p>
						{#each extraDays as day, i}
							<div class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
								<input type="date" name="extraDate" bind:value={day.date} required
									class="rounded-lg border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
								<input type="time" name="extraTime" bind:value={day.time} disabled={isFlexible}
									class="rounded-lg border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
								<button type="button" onclick={() => removeExtraDay(i)}
									class="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-red-500">✕</button>
							</div>
						{/each}
						<button type="button" onclick={addExtraDay}
							class="w-full rounded-lg border border-dashed border-ocean/40 py-2 text-xs font-medium text-ocean hover:border-ocean hover:bg-ocean/5">
							+ Add day
						</button>
					</div>
				{/if}
			{/if}

			{#if showInstructor}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Instructor</label>
					<select name="instructorId"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none">
						<option value="">— unassigned —</option>
						{#each data.instructors as instructor}
							<option value={instructor.id}>{instructor.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Clients -->
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Clients *</label>

				{#if selectedClients.length > 0}
					<div class="mb-2 flex flex-wrap gap-2">
						{#each selectedClients as c}
							<div class="flex items-center gap-1 rounded-full bg-ocean/10 py-1 pl-3 pr-1">
								<span class="text-xs font-medium text-ocean">{c.name}</span>
								<input type="hidden" name="clientId" value={c.clientId} />
								<input type="hidden" name="amountDue" value={c.amountDue} />
								<button type="button" onclick={() => removeClient(c.clientId)}
									class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-ocean/60 hover:text-ocean">✕</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if !newClientPanel}
					<div class="relative">
						<input type="text" placeholder="Search or type name to add…" bind:value={clientSearch}
							class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
						{#if filteredClients.length > 0 || showCreateNew}
							<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
								{#each filteredClients.slice(0, 6) as client}
									<button type="button" onclick={() => addClient(client)}
										class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
										{client.firstName} {client.lastName}
										{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
									</button>
								{/each}
								{#if showCreateNew}
									<button type="button" onclick={openNewClientPanel}
										class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
										+ Create "<span class="font-medium">{clientSearch}</span>"
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
						<p class="text-xs font-semibold text-ocean">New client</p>
						<div class="grid grid-cols-2 gap-2">
							<input bind:value={newFirstName} placeholder="First name *"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<input bind:value={newLastName} placeholder="Last name"
								class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						</div>
						<input bind:value={newPhone} type="tel" placeholder="Phone"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<input bind:value={newEmail} type="email" placeholder="Email"
							class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<div class="flex gap-2 pt-1">
							<button type="button" onclick={saveNewClient} disabled={!newFirstName || creatingClient}
								class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
								{creatingClient ? 'Saving…' : 'Add client'}
							</button>
							<button type="button" onclick={() => { newClientPanel = false; clientSearch = ''; }}
								class="btn-ghost btn-sm">Cancel</button>
						</div>
					</div>
				{/if}
			</div>

			{#if !isCamp}
				<details class="group">
					<summary class="cursor-pointer text-sm text-muted hover:text-gray-700">Notes & spot details ▸</summary>
					<div class="mt-3 space-y-3">
						{#if isLesson}
							<div>
								<label class="mb-1 block text-sm font-medium text-gray-700">Spot / location notes</label>
								<input name="spotNotes"
									class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
									placeholder="e.g. Playa Norte, left peak" />
							</div>
						{/if}
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700">Internal notes</label>
							<textarea name="notes" rows="2"
								class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"></textarea>
						</div>
					</div>
				</details>
			{/if}
		{/if}

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading || selectedClients.length === 0}
			class="btn-primary btn-block"
		>
			{#if loading}Saving…
			{:else if isCamp}Enroll in Camp
			{:else if isAccommodation}Book Accommodation
			{:else}Save Booking{/if}
		</button>
	</form>
</div>
