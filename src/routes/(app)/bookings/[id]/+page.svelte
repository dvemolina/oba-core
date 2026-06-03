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
	import { Zap, Waves, Bell, Tent, Shuffle } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// ── RBAC ─────────────────────────────────────────────────────────────────
	const canSeeFinancials = $derived(data.canSeeFinancials);

	// ── Flags (convenience aliases) ───────────────────────────────────────────
	const hasSessions  = $derived(data.booking.serviceHasSessions);
	const hasRoster    = $derived(data.booking.serviceHasRoster);
	const hasDateRange = $derived(!!(data.booking.serviceHasDateRange && data.booking.dateEnd));

	// ── Color maps ────────────────────────────────────────────────────────────
	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending:   'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};
	const paymentColors: Record<string, string> = {
		paid:    'bg-confirmed/15 text-green-700',
		partial: 'bg-pending/30 text-amber-700',
		pending: 'bg-gray-100 text-muted'
	};

	// ── Clients derived ───────────────────────────────────────────────────────
	const activeClients    = $derived(data.booking.clients.filter(c => c.status !== 'cancelled'));
	const cancelledClients = $derived(data.booking.clients.filter(c => c.status === 'cancelled'));
	const enrolled         = $derived(activeClients.length);
	const maxCapacity      = $derived(data.booking.serviceMaxCapacity);
	const slotsLeft        = $derived(maxCapacity != null ? maxCapacity - enrolled : null);
	const fillPct          = $derived(maxCapacity ? (enrolled / maxCapacity) * 100 : 0);

	// ── Sessions derived ──────────────────────────────────────────────────────
	const sessionsByDate = $derived(() => {
		const map: Record<string, typeof data.sessions> = {};
		for (const s of data.sessions) (map[s.date] ??= []).push(s);
		for (const d in map) map[d].sort((a, b) => a.sortOrder - b.sortOrder || (a.time ?? '').localeCompare(b.time ?? ''));
		return map;
	});
	const unscheduledSessions = $derived(data.sessions.filter(s => s.status === 'unscheduled'));
	const scheduledSessions   = $derived(data.sessions.filter(s => s.status === 'scheduled'));
	const activeSessions      = $derived(data.sessions.filter(s => s.status !== 'cancelled'));

	// ── Session duration ──────────────────────────────────────────────────────
	const serviceDuration = $derived(data.service?.durationMinutes ?? 60);
	function sessionDur(s: { durationMinutes: number | null }): number {
		return s.durationMinutes ?? serviceDuration;
	}

	// ── Session conflict detection ─────────────────────────────────────────────
	let showAddSession    = $state(false);
	let showBulkGenerate  = $state(false);
	let bulkSessionsPerDay = $state(2);
	const DEFAULT_TIMES: Record<number, string[]> = {
		1: ['09:00'], 2: ['09:00', '14:00'], 3: ['09:00', '12:00', '16:00'],
		4: ['09:00', '11:00', '14:00', '16:30']
	};
	let bulkTimes = $state(['09:00', '14:00']);
	$effect(() => { bulkTimes = DEFAULT_TIMES[bulkSessionsPerDay] ?? Array.from({ length: bulkSessionsPerDay }, () => ''); });

	let editingSessionId = $state<string | null>(null);
	let editFormTime     = $state('');
	let editFormDuration = $state(serviceDuration);
	$effect(() => {
		if (editingSessionId) {
			const s = data.sessions.find(s => s.id === editingSessionId);
			editFormTime     = s?.time?.slice(0, 5) ?? '';
			editFormDuration = sessionDur(s ?? { durationMinutes: null });
		}
	});
	const editConflicts = $derived(
		editingSessionId && editFormTime && data.allDateSessions
			? checkAllInstructorConflicts(data.instructors.map(i => i.id), data.booking.date,
				editFormTime, editFormDuration, data.allDateSessions, editingSessionId)
			: {} as Record<string, InstructorConflict[]>
	);

	let addFormTime     = $state('');
	let addFormDuration = $state(serviceDuration);
	const addConflicts = $derived(
		showAddSession && addFormTime && data.allDateSessions
			? checkAllInstructorConflicts(data.instructors.map(i => i.id), data.booking.date,
				addFormTime, addFormDuration, data.allDateSessions)
			: {} as Record<string, InstructorConflict[]>
	);

	// ── Booking edit mode ─────────────────────────────────────────────────────
	let editing         = $state(false);
	let editDate        = $state(data.booking.date);
	let editTime        = $state(data.booking.time?.slice(0, 5) ?? '');
	let editFlexible    = $state(data.booking.isFlexible);
	let editInstructorId = $state(data.booking.instructorId ?? '');
	function openEdit() {
		editDate = data.booking.date;
		editTime = data.booking.time?.slice(0, 5) ?? '';
		editFlexible = data.booking.isFlexible;
		editInstructorId = data.booking.instructorId ?? '';
		editing = true;
	}

	// ── Roster client enrollment ───────────────────────────────────────────────
	let enrollSearch  = $state('');
	let enrollPanel   = $state(false);
	let newFirstName  = $state('');
	let newLastName   = $state('');
	let newPhone      = $state('');
	let newEmail      = $state('');
	let creatingClient = $state(false);
	const enrolledIds     = $derived(new Set(data.booking.clients.map(c => c.clientId)));
	const filteredClients = $derived(
		enrollSearch.length > 1
			? data.clients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(enrollSearch.toLowerCase()) && !enrolledIds.has(c.id))
			: []
	);
	const showCreateNew  = $derived(enrollSearch.length > 1 && filteredClients.length === 0 && !enrollPanel);
	let selectedEnroll   = $state<{ clientId: string; name: string } | null>(null);
	function selectEnrollClient(c: { id: string; firstName: string; lastName: string }) {
		selectedEnroll = { clientId: c.id, name: `${c.firstName} ${c.lastName}` };
		enrollSearch = '';
	}
	function openNewClientPanel() {
		const parts = enrollSearch.trim().split(/\s+/);
		newFirstName = parts[0] ?? ''; newLastName = parts.slice(1).join(' ');
		newPhone = ''; newEmail = '';
		enrollPanel = true; enrollSearch = '';
	}
	async function saveNewEnrollClient() {
		if (!newFirstName) return;
		creatingClient = true;
		try {
			const res = await fetch('/api/v1/clients', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ firstName: newFirstName, lastName: newLastName || '—', phone: newPhone || undefined, email: newEmail || undefined })
			});
			const { data: client } = await res.json();
			selectedEnroll = { clientId: client.id, name: `${client.firstName} ${client.lastName !== '—' ? ' ' + client.lastName : ''}`.trim() };
			enrollPanel = false;
		} finally { creatingClient = false; }
	}

	// ── Post-creation confirmation banner ─────────────────────────────────────
	const isNewBooking        = $derived($page.url.searchParams.get('new') === '1');
	let confirmationDismissed = $state(false);

	// ── WhatsApp messages ─────────────────────────────────────────────────────
	function waMessage(bc: BookingClient, type: 'confirmation' | 'reminder'): string {
		const service = data.booking.serviceName ?? 'tu reserva';
		const date    = data.booking.date;
		const firstSession = data.sessions[0];
		const time = firstSession?.time ? ` a las ${firstSession.time.slice(0, 5)}`
			: data.booking.time ? ` a las ${data.booking.time.slice(0, 5)}` : '';
		if (type === 'confirmation')
			return `¡Hola ${bc.clientFirstName}! 🏄 Tu reserva de ${service} el ${date}${time} está confirmada. ¡Te esperamos! - OBA Surf`;
		return `¡Hola ${bc.clientFirstName}! 🌊 Te recordamos que mañana tienes ${service}${time}. ¡Hasta mañana! - OBA Surf`;
	}
	function waUrl(phone: string, message: string): string {
		return `https://wa.me/${phone.replace(/[\s\-\(\)\+]/g, '')}?text=${encodeURIComponent(message)}`;
	}

	// ── Generic enhance handler ───────────────────────────────────────────────
	function withToast(onSuccess?: () => void) {
		return () => async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				if (result.data?.message) toast(result.data.message);
				if (result.data?.cancelled) { await goto('/calendar'); return; }
				onSuccess?.();
				await update();
			} else if (result.type === 'failure') { await update(); }
		};
	}

	function fmtDate(d: string) {
		return new Date(d + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
	}
</script>

<div class="mx-auto max-w-lg space-y-4 p-4 md:p-6">

	<!-- ── Confirmation banner ─────────────────────────────────────────────── -->
	{#if isNewBooking && !confirmationDismissed && data.booking.clients.length > 0}
		{@const withPhone = data.booking.clients.filter(bc => bc.status === 'enrolled' && bc.clientPhone)}
		{#if withPhone.length > 0}
			<div class="rounded-(--radius-card) border border-green-200 bg-green-50 p-4">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm font-semibold text-green-800">Booking created — send confirmation?</p>
					<button type="button" onclick={() => confirmationDismissed = true}
						class="shrink-0 text-sm text-green-600 hover:text-green-800">✕</button>
				</div>
				<div class="mt-3 space-y-2">
					{#each withPhone as bc}
						<div class="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-green-100">
							<span class="text-sm font-medium text-gray-800">{bc.clientFirstName} {bc.clientLastName}</span>
							<a href={waUrl(bc.clientPhone!, waMessage(bc, 'confirmation'))} target="_blank" rel="noopener noreferrer"
								class="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
								WhatsApp ✓ Confirm
							</a>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div class="flex items-start gap-3">
		<button onclick={() => history.length > 1 ? history.back() : goto('/bookings')}
			class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0">←</button>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="inline-block h-3 w-3 shrink-0 rounded-full"
					style="background-color: {DOT_COLORS[data.booking.serviceColor as ServiceColorKey] ?? DOT_COLORS['ocean']}"></span>
				<h1 class="truncate text-xl font-bold text-navy">{data.booking.serviceName ?? 'Booking'}</h1>
			</div>
			<p class="mt-0.5 text-sm text-muted">
				{#if hasDateRange}
					{data.booking.date} → {data.booking.dateEnd}
				{:else}
					{data.booking.date}{data.booking.time ? ' · ' + data.booking.time.slice(0, 5) : ''}
					{#if data.booking.isFlexible}<Zap size={12} class="ml-1 inline text-flexible" />{/if}
				{/if}
			</p>
			{#if data.booking.serviceRunId}
				<p class="mt-0.5 text-xs text-muted">Run: {data.booking.serviceRunStartDate} → {data.booking.serviceRunEndDate}</p>
			{/if}
			{#if data.booking.source === 'whatsapp_bot'}
				<span class="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
					via WhatsApp
				</span>
			{/if}
		</div>
		<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
			{data.booking.status}
		</span>
	</div>

	<!-- ── Contract details ─────────────────────────────────────────────────── -->
	{#if !editing}
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">Details</p>
				<button type="button" onclick={openEdit} class="text-xs text-ocean hover:underline">Edit</button>
			</div>
			<div class="space-y-2.5">
				{#if data.booking.accommodationUnitName}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Unit</span>
						<span class="text-sm text-gray-800">
							{data.booking.accommodationUnitTypeName ? data.booking.accommodationUnitTypeName + ' · ' : ''}{data.booking.accommodationUnitName}
						</span>
					</div>
				{/if}
				{#if data.booking.guestsCount}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Guests</span>
						<span class="text-sm text-gray-800">{data.booking.guestsCount}</span>
					</div>
				{/if}
				{#if !hasSessions && data.booking.instructorName}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Instructor</span>
						<span class="flex items-center gap-1.5 text-sm text-gray-800"><Waves size={13} class="shrink-0 text-ocean/60" />{data.booking.instructorName}</span>
					</div>
				{/if}
				{#if data.booking.sessionsIncluded != null}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Sessions purchased</span>
						<span class="text-sm text-gray-800">{data.booking.sessionsIncluded}</span>
					</div>
				{/if}
				{#if data.booking.spotNotes}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Spot</span>
						<span class="text-sm text-gray-800">{data.booking.spotNotes}</span>
					</div>
				{/if}
				{#if data.booking.notes}
					<div>
						<p class="text-xs text-muted">Notes</p>
						<p class="mt-0.5 text-sm text-gray-700">{data.booking.notes}</p>
					</div>
				{/if}
			</div>
		</div>

	{:else}
		<!-- Edit form -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">Edit Details</p>
				<button type="button" onclick={() => editing = false} class="text-xs text-muted hover:text-gray-700">✕ Cancel</button>
			</div>
			<form method="post" action="?/update" use:enhance={withToast(() => { editing = false; })} class="space-y-3">
				<input type="hidden" name="status" value={data.booking.status} />
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted">Date</label>
						<input name="date" type="date" bind:value={editDate} required
							class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
					</div>
					{#if !hasSessions}
						<div>
							<label class="mb-1 block text-xs text-muted">Time</label>
							<input name="time" type="time" bind:value={editTime} disabled={editFlexible}
								class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
						</div>
					{/if}
				</div>
				{#if !hasSessions}
					<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" name="isFlexible" bind:checked={editFlexible} class="h-4 w-4 accent-ocean" />
						<Zap size={14} class="shrink-0" /> Flexible time
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
				<div>
					<label class="mb-1 block text-xs text-muted">Spot / location notes</label>
					<input name="spotNotes" value={data.booking.spotNotes ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
						placeholder="e.g. Playa Norte, left peak" />
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted">Internal notes</label>
					<textarea name="notes" rows="2"
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none">{data.booking.notes ?? ''}</textarea>
				</div>
				<button type="submit" class="btn-primary btn-block">Save</button>
			</form>
		</div>
	{/if}

	<!-- ── Clients & Payment ─────────────────────────────────────────────────── -->
	<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
		<!-- Header row -->
		<div class="flex items-center justify-between px-4 pt-4 pb-3">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">
				Clients & Payment
				{#if hasRoster && maxCapacity != null}
					<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
						{enrolled} / {maxCapacity}
					</span>
				{/if}
			</p>
			{#if hasRoster && (slotsLeft == null || slotsLeft > 0) && data.booking.status !== 'cancelled'}
				<button type="button" onclick={() => { selectedEnroll = null; enrollPanel = false; enrollSearch = ''; }}
					class="text-xs font-medium text-ocean hover:underline">+ Enroll</button>
			{/if}
		</div>

		{#if hasRoster && maxCapacity != null}
			<!-- Capacity progress bar -->
			<div class="mx-4 mb-3 h-1.5 overflow-hidden rounded-full bg-border">
				<div class="h-full rounded-full transition-all {fillPct >= 100 ? 'bg-flexible' : fillPct >= 80 ? 'bg-pending' : 'bg-confirmed'}"
					style="width: {Math.min(fillPct, 100)}%"></div>
			</div>
		{/if}

		{#if hasRoster && data.booking.status !== 'cancelled'}
			<!-- Enroll client inline search -->
			<div class="mx-4 mb-3">
				{#if selectedEnroll}
					<form method="post" action="?/addClient" use:enhance={withToast(() => { selectedEnroll = null; })}
						class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 ring-1 ring-ocean/30">
						<span class="flex-1 text-sm text-gray-800">{selectedEnroll.name}</span>
						<input type="hidden" name="clientId" value={selectedEnroll.clientId} />
						<input type="hidden" name="amountDue" value={data.booking.serviceMaxCapacity ? '' : ''} />
						<button type="submit" class="btn-primary btn-sm">Enroll</button>
						<button type="button" onclick={() => selectedEnroll = null} class="text-xs text-muted hover:text-gray-700">✕</button>
					</form>
				{:else if !enrollPanel}
					<div class="relative">
						<input type="text" placeholder="Search student to enroll…" bind:value={enrollSearch}
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

		<!-- Client rows -->
		<div class="divide-y divide-border/60">
			{#each activeClients as bc}
				<div class="px-4 py-3">
					<div class="mb-2 flex items-start justify-between gap-2">
						<div class="min-w-0">
							<a href="/clients/{bc.clientId}" class="text-sm font-semibold text-navy hover:text-ocean transition-colors">
								{bc.clientFirstName} {bc.clientLastName}
							</a>
							{#if bc.clientPhone}<p class="mt-0.5 text-xs text-muted">{bc.clientPhone}</p>{/if}
							{#if bc.clientEmail}<p class="text-xs text-muted">{bc.clientEmail}</p>{/if}
						</div>
					{#if canSeeFinancials}
						<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {paymentColors[bc.paymentStatus]}">{bc.paymentStatus}</span>
					{/if}
					</div>
					<div class="mb-3 space-y-2">
						<ContactButtons phone={bc.clientPhone} email={bc.clientEmail} whatsappMessage={waMessage(bc, 'confirmation')} />
						{#if bc.clientPhone}
							<a href={waUrl(bc.clientPhone, waMessage(bc, 'reminder'))} target="_blank" rel="noopener noreferrer"
								class="btn-secondary btn-sm btn-block gap-1.5"><Bell size={13} /> Send reminder</a>
						{/if}
					</div>
					{#if canSeeFinancials}
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
					{/if}
					{#if bc.status === 'enrolled' && data.booking.status !== 'cancelled'}
						<form method="post" action="?/cancelClient" use:enhance={withToast()} class="mt-2">
							<input type="hidden" name="bookingClientId" value={bc.id} />
							<button type="submit"
								onclick={(e) => { if (!confirm('Remove this client?')) e.preventDefault(); }}
								class="text-xs text-muted hover:text-red-500">Remove from booking</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>

		{#if cancelledClients.length > 0}
			<details class="border-t border-border/50">
				<summary class="cursor-pointer px-4 py-2.5 text-xs text-muted hover:text-gray-600">
					Cancelled ({cancelledClients.length})
				</summary>
				<div class="divide-y divide-border/60 pb-2">
					{#each cancelledClients as bc}
						<div class="flex items-center justify-between px-4 py-2.5 opacity-60">
							<span class="text-sm text-gray-500 line-through">{bc.clientFirstName} {bc.clientLastName}</span>
							<form method="post" action="?/reenrollClient" use:enhance={withToast()}>
								<input type="hidden" name="bookingClientId" value={bc.id} />
								<button type="submit" class="text-xs text-ocean hover:underline">Re-enroll</button>
							</form>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	</div>

	<!-- ── Sessions ─────────────────────────────────────────────────────────── -->
	{#if hasSessions}
		<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-4 pt-4 pb-3">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wider text-muted">
						Sessions
						{#if data.booking.sessionsIncluded != null}
							<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
								{scheduledSessions.length}/{data.booking.sessionsIncluded} scheduled
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
					{#if hasDateRange}
						<button type="button" onclick={() => { showBulkGenerate = !showBulkGenerate; showAddSession = false; }}
							class="text-xs font-medium text-muted hover:text-slate-700">
							{showBulkGenerate ? 'Cancel' : 'Generate'}
						</button>
					{/if}
					<button type="button" onclick={() => { showAddSession = !showAddSession; showBulkGenerate = false; }}
						class="text-xs font-medium text-ocean hover:underline">
						{showAddSession ? 'Cancel' : '+ Add'}
					</button>
				</div>
			</div>

			{#if showBulkGenerate}
				<form method="post" action="?/bulkGenerateSessions"
					use:enhance={withToast(() => { showBulkGenerate = false; })}
					class="mx-4 mb-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
					<p class="text-xs font-semibold text-amber-800">Generate for {data.booking.date} → {data.booking.dateEnd}</p>
					<div>
						<label class="text-xs text-muted">Sessions / day</label>
						<input name="sessionsPerDay" type="number" min="1" max="6" bind:value={bulkSessionsPerDay}
							class="mt-0.5 input text-xs w-24" />
					</div>
					<div class="space-y-1">
						<label class="text-xs text-muted">Times</label>
						{#each bulkTimes as _, i}
							<input name="sessionTime_{i}" type="time" bind:value={bulkTimes[i]} class="mt-0.5 input text-xs" />
						{/each}
					</div>
					<label class="flex cursor-pointer items-center gap-2">
						<input type="checkbox" name="weekdaysOnly" class="h-3.5 w-3.5 accent-ocean" />
						<span class="text-xs text-gray-700">Weekdays only</span>
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
							<input name="sessionDuration" type="number" min="15" step="15" bind:value={addFormDuration}
								class="mt-0.5 input text-xs" />
						</div>
					</div>
					<div>
						<label class="text-xs text-muted">Notes / spot</label>
						<input name="sessionNotes" placeholder="e.g. Playa Norte" class="mt-0.5 input text-xs" />
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

			<!-- Session timeline -->
			{#if data.sessions.length === 0}
				<p class="px-4 pb-4 text-sm text-muted">
					{data.booking.sessionsIncluded != null
						? `${data.booking.sessionsIncluded} session${data.booking.sessionsIncluded > 1 ? 's' : ''} to schedule — tap + Add.`
						: hasDateRange ? 'No sessions yet — use Generate or + Add.' : 'No sessions yet.'}
				</p>
			{:else}
				<div class="divide-y divide-border/60">
					{#each Object.entries(sessionsByDate()) as [date, daySessions]}
						<div class="px-4 py-3">
							<p class="mb-2 text-xs font-semibold text-muted">{fmtDate(date)}</p>
							<div class="space-y-2">
								{#each daySessions as session}
									<div class="rounded-lg border border-border bg-sand/40 p-3">
										<!-- Session summary row -->
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0">
												<p class="text-sm font-medium text-gray-800">
													{#if session.time}
														{fmtTimeRange(session.time, sessionDur(session))}
													{:else}
														<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">unscheduled</span>
													{/if}
													{#if session.notes}
														<span class="ml-1 text-xs font-normal text-muted">· {session.notes}</span>
													{/if}
												</p>
												<p class="text-xs text-muted">
													{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || '—'}
												</p>
											</div>
											<div class="flex shrink-0 items-center gap-1.5">
												<span class="text-[10px] text-muted capitalize">{session.status}</span>
												<button type="button"
													onclick={() => editingSessionId = editingSessionId === session.id ? null : session.id}
													class="btn-ghost btn-sm p-1 text-xs">Edit</button>
												<form method="post" action="?/cancelSession" use:enhance={withToast()}>
													<input type="hidden" name="sessionId" value={session.id} />
													<button type="submit"
														onclick={(e) => { if (!confirm('Cancel this session?')) e.preventDefault(); }}
														class="btn-destructive btn-sm p-1 text-xs">✕</button>
												</form>
											</div>
										</div>

										<!-- Participants -->
										<div class="mt-2 border-t border-border/40 pt-2">
											<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Attending</p>
											{#if session.participants.length > 0}
												<div class="flex flex-wrap gap-1.5">
													{#each session.participants as p}
														<div class="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 ring-1 ring-border">
															<span class="text-xs text-gray-700">{p.name}</span>
															<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
																<input type="hidden" name="participantId" value={p.id} />
																<button type="submit" class="ml-0.5 leading-none text-muted hover:text-red-500">×</button>
															</form>
														</div>
													{/each}
												</div>
											{:else}
												<p class="text-xs italic text-muted">Defaults to booking client</p>
											{/if}
											<form method="post" action="?/addParticipant" use:enhance={withToast()} class="mt-1.5 flex gap-2">
												<input type="hidden" name="sessionId" value={session.id} />
												<input name="participantName" placeholder="Add name…" class="input input-sm flex-1 text-xs" />
												<button type="submit" class="btn-ghost btn-sm text-xs">+ Add</button>
											</form>
										</div>

										<!-- Inline edit form -->
										{#if editingSessionId === session.id}
											<form method="post" action="?/updateSession"
												use:enhance={withToast(() => { editingSessionId = null; })}
												class="mt-3 space-y-2 border-t border-border/50 pt-3">
												<input type="hidden" name="sessionId" value={session.id} />
												<div class="grid grid-cols-2 gap-2">
													<div>
														<label class="text-xs text-muted">Time</label>
														<input name="sessionTime" type="time" bind:value={editFormTime}
															class="mt-0.5 input text-xs" />
													</div>
													<div>
														<label class="text-xs text-muted">Duration (min)</label>
														<input name="sessionDuration" type="number" min="15" step="15"
															bind:value={editFormDuration}
															class="mt-0.5 input text-xs" />
													</div>
													<div class="col-span-2">
														<label class="text-xs text-muted">Notes</label>
														<input name="sessionNotes" value={session.notes ?? ''}
															class="mt-0.5 input text-xs" />
													</div>
												</div>
												{#if data.instructors.length > 0}
													<div class="space-y-1.5">
														{#each data.instructors as instructor}
															{@const conflicts = editConflicts[instructor.id] ?? []}
															<label class="flex items-start gap-2 cursor-pointer">
																<input type="checkbox" name="sessionInstructorId" value={instructor.id}
																	checked={session.instructors.some(si => si.instructorId === instructor.id)}
																	class="mt-0.5 h-3.5 w-3.5 accent-ocean shrink-0" />
																<div class="min-w-0">
																	<span class="text-xs text-gray-700">{instructor.name}</span>
																	{#if conflicts.length > 0}
																		<p class="text-[10px] text-amber-600 font-medium">
																			⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'session'}
																		</p>
																	{/if}
																</div>
															</label>
														{/each}
													</div>
												{/if}
												<button type="submit" class="btn-primary btn-sm btn-block">Save session</button>
											</form>
										{/if}
									</div>
								{/each}

								<!-- Quick add on this day -->
								<form method="post" action="?/addSession" use:enhance={withToast()} class="flex items-center gap-2">
									<input type="hidden" name="sessionDate" value={date} />
									<input name="sessionTime" type="time" class="input text-xs flex-1" />
									<button type="submit" class="btn-secondary btn-sm whitespace-nowrap">+ Session</button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Join existing session (only for roster/group services) -->
			{#if hasRoster && data.linkableSessions && data.linkableSessions.length > 0}
				<div class="border-t border-border/50 px-4 py-3">
					<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
						Join existing session on {data.booking.date}
					</p>
					<div class="space-y-1.5">
						{#each data.linkableSessions as ls}
							<div class="flex items-center justify-between rounded-lg bg-sand/60 px-3 py-2 ring-1 ring-border">
								<div>
									<p class="text-xs font-medium text-gray-800">
										{ls.time ? ls.time.slice(0,5) : 'unscheduled'} · {ls.serviceName ?? 'Session'}
									</p>
									<p class="text-[11px] text-muted">
										{ls.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || 'No instructor'}
										{ls.totalParticipants > 0 ? ` · ${ls.totalParticipants} attending` : ''}
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

	<!-- ── Actions ──────────────────────────────────────────────────────────── -->
	{#if data.booking.status !== 'cancelled'}
		<div class="flex gap-3">
			{#if data.booking.status === 'pending'}
				<form method="post" action="?/update" use:enhance={withToast()} class="flex-1">
					<input type="hidden" name="status" value="confirmed" />
					<input type="hidden" name="date" value={data.booking.date} />
					<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
					<button type="submit" class="btn-primary btn-block" style="background-color: var(--color-confirmed)">
						Confirm
					</button>
				</form>
			{/if}
			<form method="post" action="?/cancel" use:enhance={withToast()} class="flex-1">
				<button type="submit"
					onclick={(e) => { if (!confirm('Cancel this booking?')) e.preventDefault(); }}
					class="btn-destructive btn-block">
					Cancel booking
				</button>
			</form>
		</div>
	{/if}

	{#if data.booking.serviceId}
		<a href="/services/{data.booking.serviceId}" class="btn-secondary btn-block text-center text-sm">
			→ Service settings
		</a>
	{/if}

</div>
