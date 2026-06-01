<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from '$lib/stores/toast.svelte';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import { fmtTimeRange, checkAllInstructorConflicts } from '$lib/features/calendar/utils';
	import type { InstructorConflict } from '$lib/features/calendar/utils';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import type { BookingClient } from '$lib/features/bookings/types';
	import ContactButtons from '$lib/components/ContactButtons.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Sessions panel state
	let showAddSession = $state(false);
	let showBulkGenerate = $state(false);
	let bulkSessionsPerDay = $state(2);
	let editingSessionId = $state<string | null>(null);

	const DEFAULT_TIMES: Record<number, string[]> = {
		1: ['09:00'],
		2: ['09:00', '14:00'],
		3: ['09:00', '12:00', '16:00'],
		4: ['09:00', '11:00', '14:00', '16:30'],
	};
	let bulkTimes = $state(['09:00', '14:00']);
	$effect(() => {
		bulkTimes = DEFAULT_TIMES[bulkSessionsPerDay] ?? Array.from({ length: bulkSessionsPerDay }, () => '');
	});
	const sessionsByDate = $derived(() => {
		const map: Record<string, typeof data.sessions> = {};
		for (const s of data.sessions) {
			(map[s.date] ??= []).push(s);
		}
		// Sort each day's sessions by sortOrder then time
		for (const d in map) map[d].sort((a, b) => a.sortOrder - b.sortOrder || (a.time ?? '').localeCompare(b.time ?? ''));
		return map;
	});
	const unscheduledSessions = $derived(data.sessions.filter(s => s.status === 'unscheduled'));
	const scheduledSessions = $derived(data.sessions.filter(s => s.status === 'scheduled'));
	const activeSessions = $derived(data.sessions.filter(s => s.status !== 'cancelled'));

	// Effective duration: session override → service default → 60 min
	const serviceDuration = $derived(data.service?.durationMinutes ?? 60);
	function sessionDuration(s: { durationMinutes: number | null }): number {
		return s.durationMinutes ?? serviceDuration;
	}

	// Conflict detection for session forms
	let bdFormTime = $state('');
	let bdFormDuration = $state(60);

	$effect(() => {
		if (editingSessionId) {
			const s = data.sessions.find(s => s.id === editingSessionId);
			bdFormTime = s?.time?.slice(0, 5) ?? '';
			bdFormDuration = sessionDuration(s ?? { durationMinutes: null });
		}
	});

	const bdConflicts = $derived(
		editingSessionId && bdFormTime && data.allDateSessions
			? checkAllInstructorConflicts(
				data.instructors.map(i => i.id),
				data.booking.date,
				bdFormTime,
				bdFormDuration,
				data.allDateSessions,
				editingSessionId
			)
			: {} as Record<string, InstructorConflict[]>
	);

	// For the "add session" form (no session ID yet — use showAddSession flag)
	let addFormTime = $state('');
	let addFormDuration = $state(serviceDuration);
	const addConflicts = $derived(
		showAddSession && addFormTime && data.allDateSessions
			? checkAllInstructorConflicts(
				data.instructors.map(i => i.id),
				data.booking.date,
				addFormTime,
				addFormDuration,
				data.allDateSessions
			)
			: {} as Record<string, InstructorConflict[]>
	);

	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending: 'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};
	const paymentColors: Record<string, string> = {
		paid: 'bg-confirmed/15 text-green-700',
		partial: 'bg-pending/30 text-amber-700',
		pending: 'bg-gray-100 text-muted'
	};

	// Generic enhance handler: toast on success, update on error
	function withToast(onSuccess?: () => void) {
		return () => async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				if (result.data?.message) toast(result.data.message);
				if (result.data?.cancelled) { await goto('/calendar'); return; }
				onSuccess?.();
				await update();
			} else if (result.type === 'failure') {
				await update();
			}
		};
	}

	// ── View / Edit mode toggle (lesson) ───────────────────────────────────
	let editing = $state(false);
	let editDate = $state(data.booking.date);
	let editTime = $state(data.booking.time?.slice(0, 5) ?? '');
	let editFlexible = $state(data.booking.isFlexible);
	let editInstructorId = $state(data.booking.instructorId ?? '');

	function openEdit() {
		editDate = data.booking.date;
		editTime = data.booking.time?.slice(0, 5) ?? '';
		editFlexible = data.booking.isFlexible;
		editInstructorId = data.booking.instructorId ?? '';
		editing = true;
	}

	// ── Camp enroll inline search ──────────────────────────────────────────
	let enrollSearch = $state('');
	let enrollPanel = $state(false);
	let newFirstName = $state('');
	let newLastName = $state('');
	let newPhone = $state('');
	let newEmail = $state('');
	let creatingClient = $state(false);

	const enrolledIds = $derived(new Set(data.booking.clients.map((c) => c.clientId)));

	const filteredClients = $derived(
		enrollSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(enrollSearch.toLowerCase()) &&
						!enrolledIds.has(c.id)
				)
			: []
	);
	const showCreateNew = $derived(enrollSearch.length > 1 && filteredClients.length === 0 && !enrollPanel);

	let selectedEnroll = $state<{ clientId: string; name: string } | null>(null);

	function selectEnrollClient(client: { id: string; firstName: string; lastName: string }) {
		selectedEnroll = { clientId: client.id, name: `${client.firstName} ${client.lastName}` };
		enrollSearch = '';
	}

	function openNewClientPanel() {
		const parts = enrollSearch.trim().split(/\s+/);
		newFirstName = parts[0] ?? '';
		newLastName = parts.slice(1).join(' ');
		newPhone = '';
		newEmail = '';
		enrollPanel = true;
		enrollSearch = '';
	}

	async function saveNewEnrollClient() {
		if (!newFirstName) return;
		creatingClient = true;
		try {
			const res = await fetch('/api/v1/clients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ firstName: newFirstName, lastName: newLastName || '—', phone: newPhone || undefined, email: newEmail || undefined })
			});
			const { data: client } = await res.json();
			selectedEnroll = { clientId: client.id, name: `${client.firstName} ${client.lastName !== '—' ? ' ' + client.lastName : ''}`.trim() };
			enrollPanel = false;
		} finally { creatingClient = false; }
	}

	const activeClients = $derived(data.booking.clients.filter((c) => c.status !== 'cancelled'));
	const cancelledClients = $derived(data.booking.clients.filter((c) => c.status === 'cancelled'));
	const enrolled = $derived(activeClients.length);
	const maxCapacity = $derived(data.booking.serviceMaxCapacity);
	const slotsLeft = $derived(maxCapacity != null ? maxCapacity - enrolled : null);
	const fillPct = $derived(maxCapacity ? Math.round((enrolled / maxCapacity) * 100) : 0);

	// Per-client editing state
	let expandedClientId = $state<string | null>(null);

	const isNewBooking = $derived($page.url.searchParams.get('new') === '1');
	let confirmationDismissed = $state(false);

	function waMessage(bc: BookingClient, type: 'confirmation' | 'reminder'): string {
		const service = data.booking.serviceName ?? 'tu reserva';
		const date = data.booking.date;
		const firstSession = data.sessions[0];
		const time = firstSession?.time
			? ` a las ${firstSession.time.slice(0, 5)}`
			: data.booking.time ? ` a las ${data.booking.time.slice(0, 5)}` : '';
		if (type === 'confirmation') {
			return `¡Hola ${bc.clientFirstName}! 🏄 Tu reserva de ${service} el ${date}${time} está confirmada. ¡Te esperamos! - OBA Surf`;
		}
		return `¡Hola ${bc.clientFirstName}! 🌊 Te recordamos que mañana tienes ${service}${time}. ¡Hasta mañana! - OBA Surf`;
	}

	function waUrl(phone: string, message: string): string {
		return `https://wa.me/${phone.replace(/[\s\-\(\)\+]/g, '')}?text=${encodeURIComponent(message)}`;
	}

	// Legacy alias used by ContactButtons
	function whatsappUrl(bc: BookingClient): string {
		return waMessage(bc, 'reminder');
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">

	<!-- ── Confirmation banner (shown once after new booking creation) ────── -->
	{#if isNewBooking && !confirmationDismissed && data.booking.clients.length > 0}
		{@const enrolledClients = data.booking.clients.filter(bc => bc.status === 'enrolled' && bc.clientPhone)}
		{#if enrolledClients.length > 0}
			<div class="mb-4 rounded-(--radius-card) border border-green-200 bg-green-50 p-4">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm font-semibold text-green-800">Booking created — send confirmation?</p>
					<button type="button" onclick={() => confirmationDismissed = true}
						class="shrink-0 text-sm text-green-600 hover:text-green-800">✕</button>
				</div>
				<div class="mt-3 space-y-2">
					{#each enrolledClients as bc}
						<div class="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-green-100">
							<span class="text-sm font-medium text-gray-800">{bc.clientFirstName} {bc.clientLastName}</span>
							<a href={waUrl(bc.clientPhone!, waMessage(bc, 'confirmation'))}
								target="_blank" rel="noopener noreferrer"
								class="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
								WhatsApp ✓ Confirm
							</a>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	{#if data.isCamp}
	<!-- ══════════════════════════ CAMP ROSTER ══════════════════════════════ -->

		<!-- Header -->
		<div class="mb-5 flex items-start gap-3">
			<button onclick={() => history.length > 1 ? history.back() : goto('/calendar')} class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg p-0">←</button>
			<div class="flex-1">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">Camp</p>
				<div class="flex items-center gap-2">
					<span class="inline-block h-3 w-3 shrink-0 rounded-full" style="background-color: {DOT_COLORS[data.booking.serviceColor as ServiceColorKey] ?? DOT_COLORS['ocean']}"></span>
					<h1 class="text-xl font-bold text-navy">{data.booking.serviceName ?? 'Camp'}</h1>
				</div>
				<p class="text-sm text-muted">{data.booking.date} → {data.booking.dateEnd}</p>
			</div>
			<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
				{data.booking.status}
			</span>
		</div>

		<!-- Enrollment progress -->
		<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<div class="mb-2 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">Enrollment</p>
				<span class="text-sm font-semibold text-navy">
					{enrolled}{maxCapacity != null ? ` / ${maxCapacity}` : ''} students
				</span>
			</div>
			{#if maxCapacity != null}
				<div class="h-2 overflow-hidden rounded-full bg-border">
					<div class="h-full rounded-full transition-all {fillPct >= 100 ? 'bg-flexible' : fillPct >= 80 ? 'bg-pending' : 'bg-confirmed'}"
						style="width: {Math.min(fillPct, 100)}%"></div>
				</div>
				<p class="mt-1 text-xs text-muted">
					{#if slotsLeft === 0}Camp is full{:else}{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} available{/if}
				</p>
			{/if}
		</div>

		<!-- Camp instructors -->
		{#if data.service?.defaultInstructorIds?.length}
			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Instructors</p>
				<div class="flex flex-wrap gap-2">
					{#each data.instructors.filter((i) => data.service?.defaultInstructorIds?.includes(i.id)) as instructor}
						<span class="rounded-full bg-ocean/10 px-3 py-1 text-xs font-medium text-ocean">🌊 {instructor.name}</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Roster -->
		<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Roster & Payments</p>

			{#if activeClients.length === 0 && cancelledClients.length === 0}
				<p class="py-4 text-center text-sm text-muted">No students enrolled yet.</p>
			{:else}
				<div class="divide-y divide-border/50">
					{#each activeClients as bc}
						<div class="py-3">
							<!-- Client header row -->
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<button type="button"
										onclick={() => expandedClientId = expandedClientId === bc.id ? null : bc.id}
										class="flex items-center gap-1.5 text-left">
										<a href="/clients/{bc.clientId}" class="text-sm font-semibold text-navy hover:text-ocean transition-colors"
											onclick={(e) => e.stopPropagation()}>
											{bc.clientFirstName} {bc.clientLastName}
										</a>
										<span class="text-[10px] text-muted">{expandedClientId === bc.id ? '▲' : '▼'}</span>
									</button>
									{#if bc.clientPhone}
										<p class="text-xs text-muted mt-0.5">{bc.clientPhone}</p>
									{/if}
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<ContactButtons phone={bc.clientPhone} email={bc.clientEmail} whatsappMessage={whatsappUrl(bc)} compact={true} />
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {paymentColors[bc.paymentStatus]}">{bc.paymentStatus}</span>
								</div>
							</div>

							<!-- Expanded controls -->
							{#if expandedClientId === bc.id}
								<div class="mt-3 space-y-3 rounded-lg bg-sand/50 p-3">
									<!-- Amount due -->
									<form method="post" action="?/updateAmountDue" use:enhance={withToast()} class="flex items-end gap-2">
										<input type="hidden" name="bookingClientId" value={bc.id} />
										<div class="flex-1">
											<label class="text-xs text-muted">Amount due (€)</label>
											<input name="amountDue" type="number" step="0.01" min="0" value={bc.amountDue}
												class="mt-0.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
										</div>
										<button type="submit" class="btn-secondary btn-sm">Save</button>
									</form>
									<!-- Amount paid -->
									<form method="post" action="?/updatePayment" use:enhance={withToast()} class="flex items-end gap-2">
										<input type="hidden" name="bookingClientId" value={bc.id} />
										<input type="hidden" name="amountDue" value={bc.amountDue} />
										<div class="flex-1">
											<label class="text-xs text-muted">Amount paid (€)</label>
											<input name="amountPaid" type="number" step="0.01" min="0" max={bc.amountDue} value={bc.amountPaid}
												class="mt-0.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
										</div>
										<button type="submit" class="btn-secondary btn-sm">Save</button>
									</form>
									<!-- Cancel enrollment -->
									<form method="post" action="?/cancelClient" use:enhance={withToast()} class="pt-1">
										<input type="hidden" name="bookingClientId" value={bc.id} />
										<button type="submit"
											onclick={(e) => { if (!confirm(`Cancel ${bc.clientFirstName}'s enrollment? They stay in history and can be re-enrolled.`)) e.preventDefault(); }}
											class="btn-destructive btn-sm btn-block">
											Cancel Enrollment
										</button>
									</form>
								</div>
							{/if}
						</div>
					{/each}

					<!-- Cancelled students (collapsible) -->
					{#if cancelledClients.length > 0}
						<details class="pt-3">
							<summary class="cursor-pointer text-xs text-muted hover:text-gray-600">
								Cancelled ({cancelledClients.length})
							</summary>
							<div class="mt-2 space-y-2">
								{#each cancelledClients as bc}
									<div class="flex items-center justify-between rounded-lg bg-sand px-3 py-2 opacity-60">
										<p class="text-sm text-gray-500 line-through">{bc.clientFirstName} {bc.clientLastName}</p>
										<form method="post" action="?/reenrollClient" use:enhance={withToast()}>
											<input type="hidden" name="bookingClientId" value={bc.id} />
											<button type="submit" class="text-xs font-medium text-ocean hover:underline">Re-enroll</button>
										</form>
									</div>
								{/each}
							</div>
						</details>
					{/if}
				</div>
			{/if}

			<!-- Enroll new client -->
			{#if slotsLeft === null || slotsLeft > 0}
				<div class="mt-4 border-t border-border/50 pt-4">
					<p class="mb-2 text-xs font-semibold text-ocean">Enroll a student</p>
					{#if selectedEnroll}
						<form method="post" action="?/enroll" use:enhance={withToast(() => { selectedEnroll = null; })} class="flex items-center gap-2">
							<input type="hidden" name="clientId" value={selectedEnroll.clientId} />
							<input type="hidden" name="amountDue" value={data.service?.basePrice ?? '0'} />
							<span class="flex-1 rounded-lg bg-ocean/10 px-3 py-2 text-sm font-medium text-ocean">{selectedEnroll.name}</span>
							<button type="submit" class="btn-primary btn-sm">Enroll</button>
							<button type="button" onclick={() => selectedEnroll = null} class="text-xs text-muted hover:text-gray-700">✕</button>
						</form>
					{:else if !enrollPanel}
						<div class="relative">
							<input type="text" placeholder="Search student…" bind:value={enrollSearch}
								class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none" />
							{#if filteredClients.length > 0 || showCreateNew}
								<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
									{#each filteredClients.slice(0, 6) as client}
										<button type="button" onclick={() => selectEnrollClient(client)}
											class="w-full px-4 py-2.5 text-left text-sm hover:bg-sand">
											{client.firstName} {client.lastName}
											{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
										</button>
									{/each}
									{#if showCreateNew}
										<button type="button" onclick={openNewClientPanel}
											class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean hover:bg-sand">
											+ Create "<span class="font-medium">{enrollSearch}</span>"
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
							<p class="text-xs font-semibold text-ocean">New client</p>
							<div class="grid grid-cols-2 gap-2">
								<input bind:value={newFirstName} placeholder="First name *" class="rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
								<input bind:value={newLastName} placeholder="Last name" class="rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							</div>
							<input bind:value={newPhone} type="tel" placeholder="Phone" class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<input bind:value={newEmail} type="email" placeholder="Email" class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<div class="flex gap-2 pt-1">
								<button type="button" onclick={saveNewEnrollClient} disabled={!newFirstName || creatingClient}
									class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
									{creatingClient ? 'Saving…' : 'Add & select'}
								</button>
								<button type="button" onclick={() => { enrollPanel = false; enrollSearch = ''; }}
									class="rounded-md px-3 py-2 text-xs text-muted ring-1 ring-border">Cancel</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Sessions panel (camps also have sessions) -->
		{#if data.booking.serviceHasSessions}
			<div class="mb-4 rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
				<div class="flex items-center justify-between px-4 pt-4 pb-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wider text-muted">
							Sessions
							{#if data.booking.sessionsIncluded != null}
								<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
									{scheduledSessions.length} / {data.booking.sessionsIncluded} scheduled
								</span>
							{:else}
								<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
									{activeSessions.length} total
								</span>
							{/if}
						</p>
						{#if unscheduledSessions.length > 0}
							<p class="mt-0.5 text-[11px] text-amber-600">{unscheduledSessions.length} need a time assigned</p>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if data.booking.dateEnd}
							<button type="button" onclick={() => { showBulkGenerate = !showBulkGenerate; showAddSession = false; }}
								class="text-xs font-medium text-muted hover:text-slate-700">
								{showBulkGenerate ? 'Cancel' : '⚡ Generate'}
							</button>
						{/if}
						<button type="button" onclick={() => { showAddSession = !showAddSession; showBulkGenerate = false; }}
							class="text-xs font-medium text-ocean hover:underline">
							{showAddSession ? 'Cancel' : '+ Add session'}
						</button>
					</div>
				</div>

				{#if showBulkGenerate}
					<form method="post" action="?/bulkGenerateSessions"
						use:enhance={withToast(() => { showBulkGenerate = false; })}
						class="mx-4 mb-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
						<p class="text-xs font-semibold text-amber-800">Generate sessions for {data.booking.date} → {data.booking.dateEnd}</p>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-xs text-muted">Sessions / day</label>
								<input name="sessionsPerDay" type="number" min="1" max="6" bind:value={bulkSessionsPerDay}
									class="mt-0.5 input text-xs" />
							</div>
						</div>
						<div class="space-y-1">
							<label class="text-xs text-muted">Times</label>
							{#each bulkTimes as _, i}
								<input name="sessionTime_{i}" type="time" bind:value={bulkTimes[i]}
									class="mt-0.5 input text-xs" />
							{/each}
						</div>
						<label class="flex cursor-pointer items-center gap-2">
							<input type="checkbox" name="weekdaysOnly" class="h-3.5 w-3.5 accent-ocean" />
							<span class="text-xs text-gray-700">Weekdays only (skip Sat/Sun)</span>
						</label>
						{#if data.sessions.length > 0}
							<label class="flex cursor-pointer items-center gap-2">
								<input type="checkbox" name="clearExisting" class="h-3.5 w-3.5 accent-red-500" />
								<span class="text-xs text-red-600">Clear existing sessions first</span>
							</label>
						{/if}
						<button type="submit" class="btn-primary btn-sm btn-block">Generate sessions</button>
					</form>
				{/if}

				{#if showAddSession}
					<form method="post" action="?/addSession" use:enhance={withToast(() => { showAddSession = false; })}
						class="mx-4 mb-3 space-y-2 rounded-lg border border-ocean/30 bg-ocean/5 p-3">
						<p class="text-xs font-semibold text-ocean">New session</p>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="text-xs text-muted">Date *</label>
								<input name="sessionDate" type="date" required value={data.booking.date} class="mt-0.5 input text-xs" />
							</div>
							<div>
								<label class="text-xs text-muted">Time</label>
								<input name="sessionTime" type="time" bind:value={addFormTime} class="mt-0.5 input text-xs" />
							</div>
							<div>
								<label class="text-xs text-muted">Duration (min)</label>
								<input name="sessionDuration" type="number" min="15" step="15"
									bind:value={addFormDuration}
									class="mt-0.5 input text-xs" />
							</div>
						</div>
						<div>
							<label class="text-xs text-muted">Notes / spot</label>
							<input name="sessionNotes" placeholder="e.g. Playa Norte, morning group" class="mt-0.5 input text-xs" />
						</div>
						{#if data.instructors.length > 0}
							<div>
								<label class="text-xs text-muted mb-1 block">Instructors</label>
								<div class="space-y-1.5">
									{#each data.instructors as instructor}
										{@const conflicts = addConflicts[instructor.id] ?? []}
										<label class="flex items-start gap-2 cursor-pointer">
											<input type="checkbox" name="sessionInstructorId" value={instructor.id}
												class="mt-0.5 h-3.5 w-3.5 accent-ocean shrink-0" />
											<div class="min-w-0">
												<span class="text-xs text-gray-700">{instructor.name}</span>
												{#if conflicts.length > 0}
													<p class="text-[10px] text-amber-600 font-medium">
														⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'session'}
														{conflicts[0].bookingStatus === 'pending' ? '(pending)' : ''}
													</p>
												{/if}
											</div>
										</label>
									{/each}
								</div>
							</div>
						{/if}
						<button type="submit" class="btn-primary btn-sm btn-block">Add session</button>
					</form>
				{/if}

				{#if data.sessions.length === 0}
					<p class="px-4 pb-4 text-sm text-muted">No sessions yet. Use ⚡ Generate to schedule the full camp, or + Add session for individual sessions.</p>
				{:else}
					<div class="divide-y divide-border/60">
						{#each Object.entries(sessionsByDate()) as [date, daySessions]}
							<div class="px-4 py-3">
								<p class="mb-2 text-xs font-semibold text-muted">
									{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
								</p>
								<div class="space-y-1.5">
									{#each daySessions as session}
										<div class="rounded-lg border border-border bg-sand/50 px-3 py-2">
											<div class="flex items-center justify-between">
												<div>
													<p class="text-sm font-medium text-gray-800">
														{#if session.time}
															{fmtTimeRange(session.time, sessionDuration(session))}
														{:else}
															<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">unscheduled</span>
														{/if}
														{#if session.notes}<span class="ml-1 text-xs text-muted">· {session.notes}</span>{/if}
													</p>
													<p class="text-xs text-muted">
														{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || 'No instructor'}
													</p>
												</div>
												<div class="flex items-center gap-1.5">
													<button type="button"
														onclick={() => editingSessionId = editingSessionId === session.id ? null : session.id}
														class="btn-ghost btn-sm p-1 text-xs">Edit</button>
													<form method="post" action="?/cancelSession" use:enhance={withToast()}>
														<input type="hidden" name="sessionId" value={session.id} />
														<button type="submit" onclick={(e) => { if (!confirm('Cancel session?')) e.preventDefault(); }}
															class="btn-destructive btn-sm p-1 text-xs">✕</button>
													</form>
												</div>
											</div>
											<!-- Participants -->
											<div class="mt-2 border-t border-border/50 pt-2">
												<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
													Who's attending
												</p>
												{#if session.participants.length > 0}
													<div class="flex flex-wrap gap-1.5">
														{#each session.participants as p}
															<div class="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 ring-1 ring-border">
																<span class="text-xs text-gray-700">{p.name}</span>
																<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
																	<input type="hidden" name="participantId" value={p.id} />
																	<button type="submit" class="ml-0.5 text-muted hover:text-red-500 leading-none text-sm">×</button>
																</form>
															</div>
														{/each}
													</div>
												{:else}
													<p class="text-xs text-muted italic">No participants set — defaults to booking client</p>
												{/if}
												<form method="post" action="?/addParticipant" use:enhance={withToast()}
													class="mt-2 flex gap-2">
													<input type="hidden" name="sessionId" value={session.id} />
													<input name="participantName" placeholder="Add name…"
														class="input input-sm flex-1 text-xs" />
													<button type="submit" class="btn btn-sm btn-ghost text-xs">+ Add</button>
												</form>
											</div>
										</div>
										{#if editingSessionId === session.id}
											<form method="post" action="?/updateSession" use:enhance={withToast(() => { editingSessionId = null; })}
												class="mb-1 space-y-2 rounded-lg border border-border bg-ocean/5 px-3 py-2">
												<input type="hidden" name="sessionId" value={session.id} />
												<div class="grid grid-cols-2 gap-2">
													<div>
														<label class="text-xs text-muted">Time</label>
														<input name="sessionTime" type="time" value={session.time ?? ''} class="mt-0.5 input text-xs" />
													</div>
													<div>
														<label class="text-xs text-muted">Duration (min)</label>
														<input name="sessionDuration" type="number" min="15" step="15"
															value={sessionDuration(session)} class="mt-0.5 input text-xs" />
													</div>
												</div>
												<div class="grid grid-cols-1 gap-2">
													<div>
														<label class="text-xs text-muted">Notes</label>
														<input name="sessionNotes" value={session.notes ?? ''} class="mt-0.5 input text-xs" />
													</div>
												</div>
												{#if data.instructors.length > 0}
													<div class="space-y-1.5">
														{#each data.instructors as instructor}
															{@const conflicts = bdConflicts[instructor.id] ?? []}
															<label class="flex items-start gap-2 cursor-pointer">
																<input type="checkbox" name="sessionInstructorId" value={instructor.id}
																	checked={session.instructors.some(i => i.instructorId === instructor.id)}
																	class="mt-0.5 h-3.5 w-3.5 accent-ocean shrink-0" />
																<div class="min-w-0">
																	<span class="text-xs text-gray-700">{instructor.name}</span>
																	{#if conflicts.length > 0}
																		<p class="text-[10px] text-amber-600 font-medium">
																			⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'session'}
																			{conflicts[0].bookingStatus === 'pending' ? '(pending)' : ''}
																		</p>
																	{/if}
																</div>
															</label>
														{/each}
													</div>
												{/if}
												<button type="submit" class="btn-primary btn-sm">Save</button>
											</form>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Linkable sessions for camp -->
				{#if data.linkableSessions && data.linkableSessions.length > 0}
					<div class="border-t border-border/50 px-4 py-3">
						<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Join an existing session on {data.booking.date}</p>
						<div class="space-y-1.5">
							{#each data.linkableSessions as ls}
								<div class="flex items-center justify-between rounded-lg bg-sand/60 px-3 py-2 ring-1 ring-border">
									<div>
										<p class="text-xs font-medium text-gray-800">
											{ls.time ? ls.time.slice(0,5) : '⚡ unscheduled'} · {ls.serviceName ?? 'Session'}
										</p>
										<p class="text-[11px] text-muted">
											{ls.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || 'No instructor'}
											{ls.totalClients > 0 ? ` · ${ls.totalClients} client${ls.totalClients > 1 ? 's' : ''}` : ''}
										</p>
									</div>
									<form method="post" action="?/linkToSession" use:enhance={withToast()}>
										<input type="hidden" name="sessionId" value={ls.id} />
										<button type="submit" class="btn-secondary btn-sm">Join</button>
									</form>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Camp actions -->
		<div class="flex flex-col gap-2">
			{#if data.booking.serviceId}
				<a href="/services/{data.booking.serviceId}"
					class="btn-secondary btn-block text-center">
					Camp Settings →
				</a>
			{/if}
			{#if data.booking.status === 'pending'}
				<form method="post" action="?/update" use:enhance={withToast()}>
					<input type="hidden" name="status" value="confirmed" />
					<input type="hidden" name="date" value={data.booking.date} />
					<input type="hidden" name="isFlexible" value="false" />
					<button type="submit" class="btn-primary btn-block" style="background-color: var(--color-confirmed)">
						Confirm Camp
					</button>
				</form>
			{/if}
		</div>

	{:else}
	<!-- ══════════════════════════ LESSON / REGULAR ══════════════════════════ -->

		<!-- Header -->
		<div class="mb-5 flex items-start gap-3">
			<button onclick={() => history.length > 1 ? history.back() : goto('/calendar')} class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg p-0">←</button>
			<div class="flex-1">
				<div class="flex items-center gap-2">
					<span class="inline-block h-3 w-3 shrink-0 rounded-full" style="background-color: {DOT_COLORS[data.booking.serviceColor as ServiceColorKey] ?? DOT_COLORS['ocean']}"></span>
					<h1 class="text-xl font-bold text-navy">{data.booking.serviceName ?? 'Booking'}</h1>
				</div>
				<p class="text-sm text-muted">
					{data.booking.date}{data.booking.time ? ' · ' + data.booking.time.slice(0, 5) : ''}
					{#if data.booking.isFlexible}<span class="ml-1 text-flexible">⚡</span>{/if}
				</p>
				{#if data.booking.source === 'whatsapp_bot'}
					<span class="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
						via WhatsApp bot
					</span>
				{/if}
			</div>
			<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
				{data.booking.status}
			</span>
		</div>

		{#if !editing}
		<!-- ── VIEW MODE ─────────────────────────────────────────────── -->

			<div class="mb-4 space-y-3 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				{#if data.booking.accommodationUnitName}
					<!-- Accommodation info -->
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted">Unit</span>
						<span class="text-sm font-medium text-gray-800">
							{data.booking.accommodationUnitTypeName ? data.booking.accommodationUnitTypeName + ' · ' : ''}{data.booking.accommodationUnitName}
						</span>
					</div>
					{#if data.booking.dateEnd}
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted">Check-out</span>
							<span class="text-sm text-gray-800">{data.booking.dateEnd}</span>
						</div>
					{/if}
					{#if data.booking.guestsCount}
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted">Guests</span>
							<span class="text-sm text-gray-800">{data.booking.guestsCount}</span>
						</div>
					{/if}
				{:else}
					<!-- Instructor (only for non-session services) -->
					{#if !data.booking.serviceHasSessions}
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted">Instructor</span>
							<span class="text-sm text-gray-800">{data.booking.instructorName ?? '—'}</span>
						</div>
					{/if}
				{/if}
				<!-- Spot notes -->
				{#if data.booking.spotNotes}
					<div class="flex items-start gap-2 text-sm text-muted">
						<span>📍</span><span>{data.booking.spotNotes}</span>
					</div>
				{/if}
				{#if data.booking.notes}
					<div class="flex items-start gap-2 text-sm text-muted">
						<span>📝</span><span>{data.booking.notes}</span>
					</div>
				{/if}
			</div>

			<!-- Sessions panel (for has_sessions services) -->
			{#if data.booking.serviceHasSessions}
				<div class="mb-4 rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
					<div class="flex items-center justify-between px-4 pt-4 pb-3">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wider text-muted">
								Sessions
								{#if data.booking.sessionsIncluded != null}
									<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
										{scheduledSessions.length} / {data.booking.sessionsIncluded} scheduled
									</span>
								{/if}
							</p>
							{#if unscheduledSessions.length > 0}
								<p class="mt-0.5 text-[11px] text-amber-600">{unscheduledSessions.length} need a time assigned</p>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if data.booking.serviceHasRoster && data.booking.dateEnd}
								<button type="button" onclick={() => { showBulkGenerate = !showBulkGenerate; showAddSession = false; }}
									class="text-xs font-medium text-muted hover:text-slate-700">
									{showBulkGenerate ? 'Cancel' : '⚡ Generate'}
								</button>
							{/if}
							<button type="button" onclick={() => { showAddSession = !showAddSession; showBulkGenerate = false; }}
								class="text-xs font-medium text-ocean hover:underline">
								{showAddSession ? 'Cancel' : '+ Add session'}
							</button>
						</div>
					</div>

					{#if showBulkGenerate}
						<form method="post" action="?/bulkGenerateSessions"
							use:enhance={withToast(() => { showBulkGenerate = false; })}
							class="mx-4 mb-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
							<p class="text-xs font-semibold text-amber-800">Generate sessions for {data.booking.date} → {data.booking.dateEnd}</p>

							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="text-xs text-muted">Sessions / day</label>
									<input name="sessionsPerDay" type="number" min="1" max="6" bind:value={bulkSessionsPerDay}
										class="mt-0.5 input text-xs" />
								</div>
							</div>

							<div class="space-y-1">
								<label class="text-xs text-muted">Times</label>
								{#each bulkTimes as _, i}
									<input name="sessionTime_{i}" type="time" bind:value={bulkTimes[i]}
										class="mt-0.5 input text-xs" />
								{/each}
							</div>

							<label class="flex cursor-pointer items-center gap-2">
								<input type="checkbox" name="weekdaysOnly" class="h-3.5 w-3.5 accent-ocean" />
								<span class="text-xs text-gray-700">Weekdays only (skip Sat/Sun)</span>
							</label>

							{#if data.sessions.length > 0}
								<label class="flex cursor-pointer items-center gap-2">
									<input type="checkbox" name="clearExisting" class="h-3.5 w-3.5 accent-red-500" />
									<span class="text-xs text-red-600">Clear existing sessions first</span>
								</label>
							{/if}

							<button type="submit" class="btn-primary btn-sm btn-block">Generate sessions</button>
						</form>
					{/if}

					{#if showAddSession}
						<form method="post" action="?/addSession" use:enhance={withToast(() => { showAddSession = false; })}
							class="mx-4 mb-3 space-y-2 rounded-lg border border-ocean/30 bg-ocean/5 p-3">
							<p class="text-xs font-semibold text-ocean">New session</p>
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label class="text-xs text-muted">Date *</label>
									<input name="sessionDate" type="date" required
										value={data.booking.date}
										class="mt-0.5 input text-xs" />
								</div>
								<div>
									<label class="text-xs text-muted">Time</label>
									<input name="sessionTime" type="time"
										class="mt-0.5 input text-xs" />
								</div>
							</div>
							<div>
								<label class="text-xs text-muted">Notes / spot</label>
								<input name="sessionNotes" placeholder="e.g. Playa Norte, morning group"
									class="mt-0.5 input text-xs" />
							</div>
							{#if data.instructors.length > 0}
								<div>
									<label class="text-xs text-muted">Instructors</label>
									<div class="mt-1 flex flex-wrap gap-2">
										{#each data.instructors as instructor}
											<label class="flex items-center gap-1.5">
												<input type="checkbox" name="sessionInstructorId" value={instructor.id}
													class="h-3.5 w-3.5 accent-ocean" />
												<span class="text-xs text-gray-700">{instructor.name}</span>
											</label>
										{/each}
									</div>
								</div>
							{/if}
							<button type="submit" class="btn-primary btn-sm btn-block">Add session</button>
						</form>
					{/if}

					{#if data.sessions.length === 0}
						<p class="px-4 pb-4 text-sm text-muted">
							{data.booking.sessionsIncluded != null
								? `${data.booking.sessionsIncluded} session${data.booking.sessionsIncluded > 1 ? 's' : ''} to schedule — tap + Add session to assign date & time.`
								: 'No sessions yet. Add the first one above.'}
						</p>
					{:else}
						<div class="divide-y divide-border/60">
							{#each Object.entries(sessionsByDate()) as [date, daySessions]}
								<div class="px-4 py-3">
									<p class="mb-2 text-xs font-semibold text-muted">
										{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
									</p>
									<div class="space-y-2">
										{#each daySessions as session}
											<div class="rounded-lg border border-border bg-sand/50 p-3">
												<div class="flex items-start justify-between gap-2">
													<div class="min-w-0">
														<p class="text-sm font-medium text-gray-800">
															{#if session.time}
																{fmtTimeRange(session.time, sessionDuration(session))}
															{:else}
																<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">unscheduled</span>
															{/if}
															{#if session.notes}
																<span class="ml-1 text-xs text-muted">· {session.notes}</span>
															{/if}
														</p>
														<p class="text-xs text-muted">
															{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || 'No instructor'}
														</p>
													</div>
													<div class="flex shrink-0 items-center gap-1.5">
														<button type="button"
															onclick={() => editingSessionId = editingSessionId === session.id ? null : session.id}
															class="btn-ghost btn-sm p-1 text-xs">Edit</button>
														<form method="post" action="?/cancelSession" use:enhance={withToast()}>
															<input type="hidden" name="sessionId" value={session.id} />
															<button type="submit" onclick={(e) => { if (!confirm('Cancel session?')) e.preventDefault(); }}
																class="btn-destructive btn-sm p-1 text-xs">✕</button>
														</form>
													</div>
												</div>

												<!-- Participants -->
												<div class="mt-2 border-t border-border/50 pt-2">
													<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
														Who's attending
													</p>
													{#if session.participants.length > 0}
														<div class="flex flex-wrap gap-1.5">
															{#each session.participants as p}
																<div class="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 ring-1 ring-border">
																	<span class="text-xs text-gray-700">{p.name}</span>
																	<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
																		<input type="hidden" name="participantId" value={p.id} />
																		<button type="submit" class="ml-0.5 text-muted hover:text-red-500 leading-none text-sm">×</button>
																	</form>
																</div>
															{/each}
														</div>
													{:else}
														<p class="text-xs text-muted italic">No participants set — defaults to booking client</p>
													{/if}
													<form method="post" action="?/addParticipant" use:enhance={withToast()}
														class="mt-2 flex gap-2">
														<input type="hidden" name="sessionId" value={session.id} />
														<input name="participantName" placeholder="Add name…"
															class="input input-sm flex-1 text-xs" />
														<button type="submit" class="btn btn-sm btn-ghost text-xs">+ Add</button>
													</form>
												</div>

												{#if editingSessionId === session.id}
													<form method="post" action="?/updateSession" use:enhance={withToast(() => { editingSessionId = null; })}
														class="mt-3 space-y-2 border-t border-border/60 pt-3">
														<input type="hidden" name="sessionId" value={session.id} />
														<div class="grid grid-cols-2 gap-2">
															<div>
																<label class="text-xs text-muted">Time</label>
																<input name="sessionTime" type="time" value={session.time ?? ''}
																	class="mt-0.5 input text-xs" />
															</div>
															<div>
																<label class="text-xs text-muted">Notes</label>
																<input name="sessionNotes" value={session.notes ?? ''}
																	class="mt-0.5 input text-xs" />
															</div>
														</div>
														{#if data.instructors.length > 0}
															<div class="flex flex-wrap gap-2">
																{#each data.instructors as instructor}
																	<label class="flex items-center gap-1.5">
																		<input type="checkbox" name="sessionInstructorId" value={instructor.id}
																			checked={session.instructors.some(si => si.instructorId === instructor.id)}
																			class="h-3.5 w-3.5 accent-ocean" />
																		<span class="text-xs text-gray-700">{instructor.name}</span>
																	</label>
																{/each}
															</div>
														{/if}
														<button type="submit" class="btn-primary btn-sm btn-block">Save session</button>
													</form>
												{/if}
											</div>
										{/each}
										<!-- Add another session on this day -->
										<form method="post" action="?/addSession" use:enhance={withToast()}
											class="flex items-center gap-2">
											<input type="hidden" name="sessionDate" value={date} />
											<input name="sessionTime" type="time" class="input text-xs flex-1" />
											<button type="submit" class="btn-secondary btn-sm whitespace-nowrap">+ Session</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Linkable sessions: sessions on the same date from other bookings -->
					{#if data.linkableSessions && data.linkableSessions.length > 0}
						<div class="border-t border-border/50 px-4 py-3">
							<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Join an existing session on {data.booking.date}</p>
							<div class="space-y-1.5">
								{#each data.linkableSessions as ls}
									<div class="flex items-center justify-between rounded-lg bg-sand/60 px-3 py-2 ring-1 ring-border">
										<div>
											<p class="text-xs font-medium text-gray-800">
												{ls.time ? ls.time.slice(0,5) : '⚡ unscheduled'} · {ls.serviceName ?? 'Session'}
											</p>
											<p class="text-[11px] text-muted">
												{ls.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || 'No instructor'}
												{ls.totalClients > 0 ? ` · ${ls.totalClients} client${ls.totalClients > 1 ? 's' : ''}` : ''}
											</p>
										</div>
										<form method="post" action="?/linkToSession" use:enhance={withToast()}>
											<input type="hidden" name="sessionId" value={ls.id} />
											<button type="submit" class="btn-secondary btn-sm">Join</button>
										</form>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Clients -->
			<div class="mb-4 rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
				<p class="px-4 pt-4 pb-3 text-xs font-semibold uppercase tracking-wider text-muted">Clients & Payment</p>
				<div class="divide-y divide-border/60">
					{#each data.booking.clients as bc}
						<div class="px-4 py-3">
							<!-- Name + payment badge -->
							<div class="flex items-start justify-between gap-2 mb-2">
								<div class="min-w-0">
									<a href="/clients/{bc.clientId}" class="text-sm font-semibold text-navy hover:text-ocean transition-colors">
										{bc.clientFirstName} {bc.clientLastName}
									</a>
									{#if bc.clientPhone}
										<p class="text-xs text-muted mt-0.5">{bc.clientPhone}</p>
									{/if}
									{#if bc.clientEmail}
										<p class="text-xs text-muted">{bc.clientEmail}</p>
									{/if}
								</div>
								<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {paymentColors[bc.paymentStatus]}">{bc.paymentStatus}</span>
							</div>

							<!-- Contact -->
							<div class="mb-3 space-y-2">
								<ContactButtons phone={bc.clientPhone} email={bc.clientEmail} whatsappMessage={waMessage(bc, 'confirmation')} />
								{#if bc.clientPhone}
									<a href={waUrl(bc.clientPhone, waMessage(bc, 'reminder'))}
										target="_blank" rel="noopener noreferrer"
										class="btn-secondary btn-sm btn-block gap-1.5">
										⏰ Send reminder
									</a>
								{/if}
							</div>

							<!-- Payment -->
							<form method="post" action="?/updatePayment" use:enhance={withToast()} class="flex items-end gap-2">
								<input type="hidden" name="bookingClientId" value={bc.id} />
								<input type="hidden" name="amountDue" value={bc.amountDue} />
								<div class="flex-1">
									<label class="text-xs text-muted">Paid of €{bc.amountDue}</label>
									<input name="amountPaid" type="number" step="0.01" min="0" max={bc.amountDue} value={bc.amountPaid}
										class="mt-0.5 input" />
								</div>
								<button type="submit" class="btn-secondary btn-sm">Save</button>
							</form>
						</div>
					{/each}
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3">
				{#if data.booking.status === 'pending'}
					<form method="post" action="?/update" use:enhance={withToast()} class="flex-1">
						<input type="hidden" name="status" value="confirmed" />
						<input type="hidden" name="date" value={data.booking.date} />
						<input type="hidden" name="time" value={data.booking.time ?? ''} />
						<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
						<input type="hidden" name="instructorId" value={data.booking.instructorId ?? ''} />
						<button type="submit" class="btn-primary btn-block" style="background-color: var(--color-confirmed)">
							Confirm Booking
						</button>
					</form>
				{/if}
				<button type="button" onclick={openEdit}
					class="btn-secondary flex-1">
					Edit
				</button>
				{#if data.booking.status !== 'cancelled'}
					<form method="post" action="?/cancel" use:enhance={withToast()} class="flex-1">
						<button type="submit"
							onclick={(e) => { if (!confirm('Cancel this booking?')) e.preventDefault(); }}
							class="btn-destructive btn-block">
							Cancel
						</button>
					</form>
				{/if}
			</div>

		{:else}
		<!-- ── EDIT MODE ─────────────────────────────────────────────── -->

			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<div class="mb-3 flex items-center justify-between">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted">Edit Booking</p>
					<button type="button" onclick={() => editing = false} class="text-xs text-muted hover:text-gray-700">✕ Cancel edit</button>
				</div>
				<form method="post" action="?/update"
					use:enhance={withToast(() => { editing = false; })}
					class="space-y-4"
				>
					<input type="hidden" name="status" value={data.booking.status} />
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs text-muted">Date</label>
							<input name="date" type="date" bind:value={editDate} required
								class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
						</div>
						{#if !data.booking.serviceHasSessions}
							<div>
								<label class="mb-1 block text-xs text-muted">Time</label>
								<input name="time" type="time" bind:value={editTime} disabled={editFlexible}
									class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
							</div>
						{/if}
					</div>
					{#if !data.booking.serviceHasSessions}
						<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
							<input type="checkbox" name="isFlexible" bind:checked={editFlexible} class="h-4 w-4 accent-ocean" />
							⚡ Flexible time
						</label>
						<div>
							<label class="mb-1 block text-xs text-muted">Instructor</label>
							<select name="instructorId" bind:value={editInstructorId}
								class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none">
								<option value="">— unassigned —</option>
								{#each data.instructors as instructor}
									<option value={instructor.id}>{instructor.name}</option>
								{/each}
							</select>
						</div>
					{/if}
					<button type="submit" class="btn-primary btn-block">
						Save Changes
					</button>
				</form>
			</div>

		{/if}
	{/if}

	{#if form?.error}
		<p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
	{/if}
</div>
