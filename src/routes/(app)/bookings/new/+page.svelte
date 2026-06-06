<script lang="ts">
	import { untrack } from 'svelte';
	import { Zap } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import FormSection from '$lib/components/bookings/FormSection.svelte';
	import SessionSection from '$lib/components/bookings/sections/SessionSection.svelte';
	import NotesSection from '$lib/components/bookings/sections/NotesSection.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	// ── Service selection ──────────────────────────────────────────────────────
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));
	const isCamp = $derived(!!(selectedService?.hasRoster && selectedService?.hasDateRange));
	const isLesson = $derived(!!(selectedService?.hasSessions && !isCamp));
	const isAccommodation = $derived(!!selectedService?.hasInventoryUnits);
	const runs = $derived(selectedService ? (data.runsByService[selectedService.id] ?? []) : []);
	const showInstructor = $derived(
		!isLesson && !isCamp && !isAccommodation && (selectedService?.requiresInstructor ?? false)
	);

	// ── Lesson: sessions + participants ────────────────────────────────────────
	let sessionsIncluded = $state(untrack(() => selectedService?.defaultSessionsIncluded ?? 1));
	let participantMode = $state<'count' | 'names'>('count');
	let participantCount = $state(1);
	let participantNames = $state<string[]>([]);

	function addParticipantField() {
		participantNames = [...participantNames, ''];
	}
	function removeParticipantField(i: number) {
		participantNames = participantNames.filter((_, idx) => idx !== i);
	}

	// Update sessionsIncluded when service changes (reads only selectedService, writes via untrack)
	$effect(() => {
		const def = selectedService?.defaultSessionsIncluded;
		if (selectedService?.hasSessions && def) {
			untrack(() => { sessionsIncluded = def; });
		}
	});

	// ── Session states — pre-allocated to max size to avoid any resize effect loop ──
	const MAX_SESSIONS = 20;
	const _initFlexible = (data.defaultTime ?? '') === '';
	let sessionDates = $state<string[]>(
		Array.from({ length: MAX_SESSIONS }, (_, i) => (i === 0 ? (data.defaultDate ?? '') : ''))
	);
	let sessionTimes = $state<string[]>(
		Array.from({ length: MAX_SESSIONS }, (_, i) => (i === 0 ? (data.defaultTime ?? '') : ''))
	);
	let sessionFlexibles = $state<boolean[]>(
		Array.from({ length: MAX_SESSIONS }, (_, i) => (i === 0 ? _initFlexible : false))
	);
	let sessionLevels = $state<Array<'beginner' | 'intermediate' | 'advanced' | ''>>(
		Array.from({ length: MAX_SESSIONS }, () => '' as const)
	);
	let sessionInstructorIds = $state<string[][]>(
		Array.from({ length: MAX_SESSIONS }, () => [])
	);
	// Session 0 starts open, rest closed
	let sessionOpen = $state<boolean[]>(
		Array.from({ length: MAX_SESSIONS }, (_, i) => i === 0)
	);

	// ── Accordion open states ─────────────────────────────────────────────────
	let notesOpen = $state(false);

	// ── Shared client state (accommodation, camp, regular) ─────────────────────
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let clientSearch = $state('');
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
		const price = selectedService?.basePrice ?? '0';
		selectedClients = [
			...selectedClients,
			{ clientId: client.id, name: `${client.firstName} ${client.lastName}`, amountDue: price }
		];
		clientSearch = '';
	}
	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}

	// ── Inline new-client mini-form ────────────────────────────────────────────
	let newClientPanel = $state(false);
	let newFirstName = $state('');
	let newLastName = $state('');
	let newPhone = $state('');
	let newEmail = $state('');
	let creatingClient = $state(false);
	const showCreateNew = $derived(
		clientSearch.length > 1 && filteredClients.length === 0 && !newClientPanel
	);

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
					name: `${client.firstName}${client.lastName !== '—' ? ' ' + client.lastName : ''}`.trim(),
					amountDue: selectedService?.basePrice ?? '0'
				}
			];
			newClientPanel = false;
		} finally {
			creatingClient = false;
		}
	}

	// ── Camp state ─────────────────────────────────────────────────────────────
	let selectedRunId = $state('');
	const selectedRun = $derived(runs.find((r) => r.id === selectedRunId));

	// ── Regular service state ──────────────────────────────────────────────────
	let regularDate = $state(data.defaultDate ?? '');
	let regularTime = $state(data.defaultTime ?? '');
	let isFlexibleRegular = $state(untrack(() => (data.defaultTime ?? '') === ''));
	let instructorId = $state('');
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

	// ── Notes (lesson/regular) ─────────────────────────────────────────────────
	let spotNotes = $state('');
	let notes = $state('');

	// ── Session badge helpers ──────────────────────────────────────────────────
	function sessionBadge(i: number): string {
		if (sessionFlexibles[i]) return '⚡';
		if (sessionTimes[i]) return sessionTimes[i].slice(0, 5);
		return m.booking_new_session_not_scheduled();
	}
	function sessionBadgeVariant(i: number): 'done' | 'progress' | 'neutral' {
		return sessionTimes[i] && !sessionFlexibles[i] ? 'done' : 'neutral';
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">{m.booking_new_title()}</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</div>
	{/if}

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
					toast(d.message ?? m.booking_new_title());
					if (d.multiDay) await goto(`/calendar?date=${d.date}`);
					else if (d.bookingId) await goto(`/bookings/${d.bookingId}?new=1`);
				} else {
					await update();
				}
			};
		}}
	>
		<!-- ── Booking basics (all types) ──────────────────────────────────────── -->
		<FormSection title={m.booking_new_title()} open={true}>
			<!-- Service selector (always) -->
			<div class="mb-4">
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_service()}</label>
				<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
					{#each data.services as s}
						<option value={s.id}>{s.name} — €{s.basePrice}</option>
					{/each}
				</select>
			</div>

			{#if isLesson}
				<!-- Lesson: sessions count + participants (date/time live in session sections) -->
				<div class="space-y-4">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
							{m.booking_new_sessions_included()}
						</label>
						<input
							type="number"
							name="sessionsIncluded"
							bind:value={sessionsIncluded}
							min="1"
							max="20"
							required
							class="input w-full"
						/>
						<p class="mt-1 text-xs text-muted">{m.booking_new_sessions_hint()}</p>
					</div>

					<!-- Participants -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<label class="text-xs font-semibold uppercase tracking-wide text-muted">
								{m.booking_new_participants()} <span class="font-normal normal-case">(optional)</span>
							</label>
							<div class="flex gap-1">
								<button
									type="button"
									onclick={() => (participantMode = 'count')}
									class="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors
										{participantMode === 'count' ? 'bg-ocean/10 text-ocean' : 'bg-gray-100 text-muted'}"
								>
									{m.booking_new_participant_mode_count()}
								</button>
								<button
									type="button"
									onclick={() => (participantMode = 'names')}
									class="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors
										{participantMode === 'names' ? 'bg-ocean/10 text-ocean' : 'bg-gray-100 text-muted'}"
								>
									{m.booking_new_participant_mode_names()}
								</button>
							</div>
						</div>

						{#if participantMode === 'count'}
							<input
								type="number"
								name="participantCount"
								bind:value={participantCount}
								min="1"
								class="input w-full"
								placeholder={m.booking_new_participant_count()}
							/>
						{:else}
							{#each participantNames as _, i}
								<div class="mb-2 flex gap-2">
									<input
										type="text"
										name="participantName"
										bind:value={participantNames[i]}
										placeholder={m.booking_new_participant_placeholder()}
										class="input flex-1"
									/>
									<button type="button" onclick={() => removeParticipantField(i)} class="text-muted hover:text-red-500">✕</button>
								</div>
							{/each}
							<button type="button" onclick={addParticipantField} class="text-sm text-ocean hover:underline">
								{m.booking_new_add_participant()}
							</button>
						{/if}
					</div>
				</div>
			{:else if isAccommodation}
				{#if selectedService?.hasInventoryUnits}
					{@const links = data.inventoryLinksByService[selectedService.id] ?? []}
					<div class="space-y-3">
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="mb-1 block text-sm font-medium text-gray-700" for="inv-date">{m.booking_new_checkin()}</label>
								<input id="inv-date" name="date" type="date" required value={data.defaultDate}
									class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
							</div>
							<div>
								<label class="mb-1 block text-sm font-medium text-gray-700" for="inv-dateEnd">{m.booking_new_checkout()}</label>
								<input id="inv-dateEnd" name="dateEnd" type="date" required
									class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
							</div>
						</div>

						{#if links.length === 0}
							<p class="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
								{m.booking_new_inventory_no_links()} <a href="/services/{selectedService.id}" class="underline">{m.booking_new_inventory_configure()}</a>.
							</p>
						{:else}
							{#each links as link}
								<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
									<div class="mb-2 flex items-center justify-between">
										<p class="text-sm font-medium text-gray-900">{link.itemType.name}</p>
										<span class="text-xs text-gray-500">{link.isIncluded ? m.booking_new_inventory_included() : m.booking_new_inventory_addon()}</span>
									</div>
									<div class="flex flex-wrap gap-3">
										<div>
											<label class="mb-1 block text-xs text-gray-600" for="qty_{link.itemTypeId}">{m.booking_new_inventory_quantity()}</label>
											<input id="qty_{link.itemTypeId}" name="qty_{link.itemTypeId}" type="number" min="1"
												value={link.quantityPerBooking}
												class="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
										</div>
										{#each Object.entries(link.itemType.attributeSchema) as [key, values]}
										<div>
											<label class="mb-1 block text-xs text-gray-600 capitalize" for="attr_{link.itemTypeId}_{key}">{key}</label>
											<select id="attr_{link.itemTypeId}_{key}" name="attr_{link.itemTypeId}_{key}"
												class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
												<option value="">—</option>
												{#each values as v}<option value={v}>{v}</option>{/each}
											</select>
										</div>
										{/each}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			{:else if isCamp}
				<!-- Camp: run picker + date display -->
				<div class="space-y-3">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_run()}</label>
						{#if runs.length > 0}
							<select name="serviceRunId" bind:value={selectedRunId} required class="input w-full">
								<option value="">{m.booking_new_run_select()}</option>
								{#each runs as run}
									<option value={run.id} disabled={!run.active}>
										{run.startDate} → {run.endDate}{run.maxCapacity ? ` (${run.enrolledCount}/${run.maxCapacity})` : ''}{run.notes ? ` · ${run.notes}` : ''}
									</option>
								{/each}
							</select>
							{#if selectedRun}
								<p class="mt-1 text-xs text-muted">📅 {selectedRun.startDate} → {selectedRun.endDate}</p>
								<input type="hidden" name="date" value={selectedRun.startDate} />
								<input type="hidden" name="dateEnd" value={selectedRun.endDate} />
							{:else}
								<input type="date" name="date" required value={data.defaultDate} class="input w-full mt-2" />
							{/if}
						{:else}
							<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
								{m.booking_new_no_runs()} <a href="/services/{selectedService?.id}" class="underline">{m.booking_new_add_run()}</a>
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Regular service: date, time, flexible, instructor -->
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
							<input type="date" name="date" bind:value={regularDate} required class="input w-full" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_time()}</label>
							<input type="time" name="time" bind:value={regularTime} disabled={isFlexibleRegular} class="input w-full disabled:opacity-40" />
						</div>
					</div>
					<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
						<input type="checkbox" name="isFlexible" bind:checked={isFlexibleRegular} class="h-4 w-4 accent-ocean" />
						<div>
							<p class="flex items-center gap-1.5 text-sm font-medium text-gray-800"><Zap size={14} /> {m.booking_new_flexible()}</p>
							<p class="text-xs text-muted">{m.booking_new_flexible_desc()}</p>
						</div>
					</label>
					{#if showInstructor}
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_instructor()}</label>
							<select name="instructorId" bind:value={instructorId} class="input w-full">
								<option value="">{m.booking_new_unassigned()}</option>
								{#each data.instructors as inst}
									<option value={inst.id}>{inst.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			{/if}
		</FormSection>

		<!-- ── Clients section (accommodation, camp, regular) ──────────────────── -->
		{#if !isLesson && selectedService}
			<FormSection title={m.booking_new_clients()} open={true}>
				<div class="space-y-2">
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
							<input type="text" placeholder={m.booking_new_client_search()} bind:value={clientSearch} autocomplete="off" class="input w-full" />
							{#if filteredClients.length > 0 || showCreateNew}
								<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
									{#each filteredClients.slice(0, 6) as client}
										<button type="button" onclick={() => addClient(client)} class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
											{client.firstName} {client.lastName}
											{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
										</button>
									{/each}
									{#if showCreateNew}
										<button type="button" onclick={openNewClientPanel} class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
											{m.booking_new_create_client()} "<span class="font-medium">{clientSearch}</span>"
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
							<p class="text-xs font-semibold text-ocean">{m.booking_new_add_client()}</p>
							<div class="grid grid-cols-2 gap-2">
								<input bind:value={newFirstName} placeholder={m.client_new_first_name()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
								<input bind:value={newLastName} placeholder={m.common_name()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							</div>
							<input bind:value={newPhone} type="tel" placeholder={m.common_phone()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							<input bind:value={newEmail} type="email" placeholder={m.common_email()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							<div class="flex gap-2 pt-1">
								<button type="button" onclick={saveNewClient} disabled={!newFirstName || creatingClient}
									class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
									{creatingClient ? m.booking_new_saving() : m.common_add()}
								</button>
								<button type="button" onclick={() => { newClientPanel = false; clientSearch = ''; }} class="btn-ghost btn-sm">{m.common_cancel()}</button>
							</div>
						</div>
					{/if}
				</div>
			</FormSection>
		{/if}

		<!-- ── Lesson client (payer) section ───────────────────────────────────── -->
		{#if isLesson && selectedService}
			<FormSection title={m.booking_new_clients()} open={true}>
				<div class="space-y-2">
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
							<input type="text" placeholder={m.booking_new_client_search()} bind:value={clientSearch} autocomplete="off" class="input w-full" />
							{#if filteredClients.length > 0 || showCreateNew}
								<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
									{#each filteredClients.slice(0, 6) as client}
										<button type="button" onclick={() => addClient(client)} class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
											{client.firstName} {client.lastName}
											{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
										</button>
									{/each}
									{#if showCreateNew}
										<button type="button" onclick={openNewClientPanel} class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
											{m.booking_new_create_client()} "<span class="font-medium">{clientSearch}</span>"
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
							<p class="text-xs font-semibold text-ocean">{m.booking_new_add_client()}</p>
							<div class="grid grid-cols-2 gap-2">
								<input bind:value={newFirstName} placeholder={m.client_new_first_name()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
								<input bind:value={newLastName} placeholder={m.common_name()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							</div>
							<input bind:value={newPhone} type="tel" placeholder={m.common_phone()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							<input bind:value={newEmail} type="email" placeholder={m.common_email()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
							<div class="flex gap-2 pt-1">
								<button type="button" onclick={saveNewClient} disabled={!newFirstName || creatingClient}
									class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
									{creatingClient ? m.booking_new_saving() : m.common_add()}
								</button>
								<button type="button" onclick={() => { newClientPanel = false; clientSearch = ''; }} class="btn-ghost btn-sm">{m.common_cancel()}</button>
							</div>
						</div>
					{/if}
				</div>
			</FormSection>
		{/if}

		<!-- ── Session sections (lesson only, one per session) ─────────────────── -->
		{#if isLesson}
			<!-- Server reads top-level date/time/isFlexible for session 0 -->
			<input type="hidden" name="date" value={sessionDates[0] ?? ''} />
			<input type="hidden" name="time" value={sessionFlexibles[0] ? '' : (sessionTimes[0] ?? '')} />
			<input type="hidden" name="isFlexible" value={sessionFlexibles[0] ? 'on' : ''} />

			{#each Array.from({ length: sessionsIncluded }, (_, i) => i) as i (i)}
				<FormSection
					title="{m.booking_new_session_n({ n: i + 1 })} {m.booking_new_session_of({ total: sessionsIncluded })}"
					badge={sessionBadge(i)}
					badgeVariant={sessionBadgeVariant(i)}
					bind:open={sessionOpen[i]}
				>
					<SessionSection
						index={i}
						total={sessionsIncluded}
						instructors={data.instructors}
						bind:date={sessionDates[i]}
						bind:time={sessionTimes[i]}
						bind:isFlexible={sessionFlexibles[i]}
						bind:skillLevel={sessionLevels[i]}
						bind:instructorIds={sessionInstructorIds[i]}
					/>
				</FormSection>
			{/each}
		{/if}

		<!-- ── Additional days (regular services only, collapsed) ──────────────── -->
		{#if !isLesson && !isAccommodation && !isCamp && selectedService}
			<FormSection title={m.booking_new_additional_days()} open={false}>
				<div class="space-y-2">
					<p class="text-xs text-muted">{m.booking_new_repeat_hint()}</p>
					{#each extraDays as day, i}
						<div class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
							<input type="date" name="extraDate" bind:value={day.date} required class="input" />
							<input type="time" name="extraTime" bind:value={day.time} disabled={isFlexibleRegular} class="input disabled:opacity-40" />
							<button type="button" onclick={() => { extraDays = extraDays.filter((_, idx) => idx !== i); }}
								class="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-red-500">✕</button>
						</div>
					{/each}
					<button type="button" onclick={addExtraDay}
						class="w-full rounded-lg border border-dashed border-ocean/40 py-2 text-xs font-medium text-ocean hover:border-ocean hover:bg-ocean/5">
						{m.booking_new_add_day()}
					</button>
				</div>
			</FormSection>
		{/if}

		<!-- ── Notes (lesson + regular, collapsed) ─────────────────────────────── -->
		{#if !isCamp && !isAccommodation}
			<FormSection title={m.booking_new_notes_section()} bind:open={notesOpen}>
				<NotesSection bind:spotNotes bind:notes />
			</FormSection>
		{/if}

		<button type="submit" disabled={loading || selectedClients.length === 0} class="btn-primary btn-block mt-2">
			{loading ? m.booking_new_saving() : (isAccommodation ? m.booking_new_accommodation() : m.booking_new_submit())}
		</button>
	</form>
</div>
