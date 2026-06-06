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
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

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
	let editSessionLevel = $state('');
	$effect(() => {
		if (editingSessionId) {
			const s = data.sessions.find(s => s.id === editingSessionId);
			editFormTime     = s?.time?.slice(0, 5) ?? '';
			editFormDuration = sessionDur(s ?? { durationMinutes: null });
			editSessionLevel = s?.skillLevel ?? '';
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

	// ── Inventory allocations ─────────────────────────────────────────────────
	function groupInventoryItems(
		items: { id: string; name: string; attributes: Record<string, string>; status: string }[],
		attrEntries: [string, string[]][]
	) {
		type G = { label: string; attrs: Record<string, string>; available: number; total: number; items: typeof items };
		if (items.length === 0) return [] as G[];
		if (attrEntries.length === 0)
			return [{ label: '', attrs: {}, available: items.filter(i => i.status === 'available').length, total: items.length, items }];
		const map = new Map<string, G>();
		for (const item of items) {
			const label = attrEntries.map(([k]) => item.attributes[k]).filter(v => v?.trim()).join(' · ');
			const attrs = Object.fromEntries(attrEntries.map(([k]) => [k, item.attributes[k] ?? ''])) as Record<string, string>;
			if (!map.has(label)) map.set(label, { label, attrs, available: 0, total: 0, items: [] });
			const g = map.get(label)!;
			g.total++;
			g.items.push(item);
			if (item.status === 'available') g.available++;
		}
		return Array.from(map.values());
	}

	let addingAlloc = $state(false);
	let addAllocTypeId = $state(data.serviceInventoryLinks[0]?.itemTypeId ?? '');
	let addAllocQty = $state(1);
	let addAllocSelectedGroup = $state<string | null>(null);
	let reassigningAllocId = $state<string | null>(null);
	let reassignGroupSelections = $state<Record<string, string | null>>({});

	const ALLOC_STATUS_OPTIONS: { value: string; label: string }[] = [
		{ value: 'allocated', label: 'Allocated' },
		{ value: 'returned',  label: 'Returned' },
		{ value: 'damaged',   label: 'Damaged' },
		{ value: 'lost',      label: 'Lost' }
	];
	const ALLOC_STATUS_COLORS: Record<string, string> = {
		allocated: 'bg-emerald-50 text-emerald-700',
		returned:  'bg-blue-50 text-blue-700',
		damaged:   'bg-amber-50 text-amber-700',
		lost:      'bg-red-50 text-red-700'
	};

	// Items for the currently-selected add type (filtered for add-alloc form)
	const addAllocItems = $derived(
		addAllocTypeId ? (data.itemsByAllocType[addAllocTypeId] ?? []) : []
	);

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
		return new Date(d + 'T00:00:00').toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
	}
</script>

<div class="mx-auto max-w-lg space-y-4 p-4 md:p-6">

	<!-- ── Confirmation banner ─────────────────────────────────────────────── -->
	{#if isNewBooking && !confirmationDismissed && data.booking.clients.length > 0}
		{@const withPhone = data.booking.clients.filter(bc => bc.status === 'enrolled' && bc.clientPhone)}
		{#if withPhone.length > 0}
			<div class="rounded-(--radius-card) border border-green-200 bg-green-50 p-4">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm font-semibold text-green-800">{m.booking_detail_confirm_prompt()}</p>
					<button type="button" onclick={() => confirmationDismissed = true}
						class="shrink-0 text-sm text-green-600 hover:text-green-800">✕</button>
				</div>
				<div class="mt-3 space-y-2">
					{#each withPhone as bc}
						<div class="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-green-100">
							<span class="text-sm font-medium text-gray-800">{bc.clientFirstName} {bc.clientLastName}</span>
							<a href={waUrl(bc.clientPhone!, waMessage(bc, 'confirmation'))} target="_blank" rel="noopener noreferrer"
								class="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
								{m.booking_detail_whatsapp_confirm()}
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
				<p class="mt-0.5 text-xs text-muted">{m.booking_detail_run()} {data.booking.serviceRunStartDate} → {data.booking.serviceRunEndDate}</p>
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
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">{m.booking_detail_details()}</p>
				<button type="button" onclick={openEdit} class="text-xs text-ocean hover:underline">{m.common_edit()}</button>
			</div>
			<div class="space-y-2.5">
				{#if data.booking.participantCount}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">{m.booking_new_participants()}</span>
						<span class="text-sm text-gray-800">{m.booking_detail_participant_count({ count: data.booking.participantCount })}</span>
					</div>
				{/if}
				{#if !hasSessions && data.booking.instructorName}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">{m.booking_new_instructor()}</span>
						<span class="flex items-center gap-1.5 text-sm text-gray-800"><Waves size={13} class="shrink-0 text-ocean/60" />{data.booking.instructorName}</span>
					</div>
				{/if}
				{#if data.booking.sessionsIncluded != null}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">{m.booking_detail_sessions_purchased()}</span>
						<span class="text-sm text-gray-800">{data.booking.sessionsIncluded}</span>
					</div>
				{/if}
				{#if data.booking.spotNotes}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">{m.booking_detail_spot()}</span>
						<span class="text-sm text-gray-800">{data.booking.spotNotes}</span>
					</div>
				{/if}
				{#if data.booking.notes}
					<div>
						<p class="text-xs text-muted">{m.common_notes()}</p>
						<p class="mt-0.5 text-sm text-gray-700">{data.booking.notes}</p>
					</div>
				{/if}
				{#if canSeeFinancials && (data.booking.priceOverride || data.booking.serviceBasePrice)}
					<div class="flex items-center justify-between">
						<span class="text-xs text-muted">Precio por cliente</span>
						<span class="text-sm font-medium text-gray-800">
							€{data.booking.priceOverride ?? data.booking.serviceBasePrice}
							{#if data.booking.priceOverride}<span class="ml-1 text-[10px] text-amber-600">(personalizado)</span>{/if}
						</span>
					</div>
				{/if}
			</div>
		</div>

	{:else}
		<!-- Edit form -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">{m.booking_detail_edit_details()}</p>
				<button type="button" onclick={() => editing = false} class="text-xs text-muted hover:text-gray-700">{m.booking_detail_cancel()}</button>
			</div>
			<form method="post" action="?/update" use:enhance={withToast(() => { editing = false; })} class="space-y-3">
				<input type="hidden" name="status" value={data.booking.status} />
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted">{m.booking_new_date()}</label>
						<input name="date" type="date" bind:value={editDate} required
							class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
					</div>
					{#if !hasSessions}
						<div>
							<label class="mb-1 block text-xs text-muted">{m.booking_new_time()}</label>
							<input name="time" type="time" bind:value={editTime} disabled={editFlexible}
								class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
						</div>
					{/if}
				</div>
				{#if !hasSessions}
					<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" name="isFlexible" bind:checked={editFlexible} class="h-4 w-4 accent-ocean" />
						<Zap size={14} class="shrink-0" /> {m.booking_new_flexible()}
					</label>
					<div>
						<label class="mb-1 block text-xs text-muted">{m.booking_new_instructor()}</label>
						<select name="instructorId" bind:value={editInstructorId}
							class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none">
							<option value="">{m.booking_new_unassigned()}</option>
							{#each data.instructors as instructor}
								<option value={instructor.id}>{instructor.name}</option>
							{/each}
						</select>
					</div>
				{/if}
				<div>
					<label class="mb-1 block text-xs text-muted">{m.booking_new_spot_notes()}</label>
					<input name="spotNotes" value={data.booking.spotNotes ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
						placeholder={m.booking_new_spot_placeholder()} />
				</div>
				<div>
					<label class="mb-1 block text-xs text-muted">{m.booking_new_internal_notes()}</label>
					<textarea name="notes" rows="2"
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none">{data.booking.notes ?? ''}</textarea>
				</div>
				{#if canSeeFinancials}
				<div>
					<label class="mb-1 block text-xs text-muted">Precio por cliente (€)</label>
					<input name="priceOverride" type="number" step="0.01" min="0"
						value={data.booking.priceOverride ?? data.booking.serviceBasePrice ?? ''}
						placeholder={data.booking.serviceBasePrice ? `Base: €${data.booking.serviceBasePrice}` : 'Precio'}
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
					<p class="mt-0.5 text-[10px] text-muted">Sobrescribe el precio base del servicio para esta reserva</p>
				</div>
				{/if}
				<button type="submit" class="btn-primary btn-block">{m.common_save()}</button>
			</form>
		</div>
	{/if}

	<!-- ── Inventory Allocations ────────────────────────────────────────────── -->
	{#if data.booking.allocations.length > 0 || data.serviceInventoryLinks.length > 0}
	<div class="rounded-xl border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-gray-100 p-4">
			<h2 class="font-semibold text-gray-900">{m.booking_detail_inventory_section()}</h2>
			{#if data.serviceInventoryLinks.length > 0 && data.booking.status !== 'cancelled'}
			<button
				type="button"
				onclick={() => { addingAlloc = !addingAlloc; addAllocTypeId = data.serviceInventoryLinks[0]?.itemTypeId ?? ''; addAllocQty = 1; addAllocSelectedGroup = null; }}
				class="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
			>+ Add</button>
			{/if}
		</div>

		<!-- Add allocation form -->
		{#if addingAlloc}
		{@const addLink = data.serviceInventoryLinks.find(l => l.itemTypeId === addAllocTypeId)}
		{@const addAttrEntries = Object.entries(addLink?.itemType.attributeSchema ?? {})}
		{@const addGroups = groupInventoryItems(addAllocItems, addAttrEntries)}
		{@const addSelectedGroup = addGroups.find(g => g.label === addAllocSelectedGroup) ?? null}
		{@const availCount = (addSelectedGroup ? addSelectedGroup.items : addAllocItems).filter(i => i.status === 'available').length}
		<form method="POST" action="?/addAlloc"
			use:enhance={withToast(() => { addAllocSelectedGroup = null; addAllocQty = 1; })}
			class="border-b border-gray-100 bg-gray-50 p-4 space-y-3">
			<!-- Type selector -->
			{#if data.serviceInventoryLinks.length > 1}
			<div>
				<label class="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
				<select name="itemTypeId" bind:value={addAllocTypeId}
					onchange={() => { addAllocSelectedGroup = null; addAllocQty = 1; }}
					class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
					{#each data.serviceInventoryLinks as link}
						<option value={link.itemTypeId}>{link.itemType.name}</option>
					{/each}
				</select>
			</div>
			{:else}
				<input type="hidden" name="itemTypeId" value={addAllocTypeId} />
				<p class="text-xs font-semibold text-gray-700">{addLink?.itemType.name}</p>
			{/if}

			{#if addAttrEntries.length > 0}
			<!-- Variant chips -->
			<div>
				<p class="mb-1.5 text-xs font-medium text-gray-600">Variante</p>
				<div class="flex flex-wrap gap-1.5">
					{#each addGroups as group}
					{@const isSelected = addAllocSelectedGroup === group.label}
					<button type="button"
						onclick={() => { addAllocSelectedGroup = isSelected ? null : group.label; addAllocQty = 1; }}
						class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
							{group.available === 0 ? 'opacity-50' : ''}
							{isSelected ? 'border-ocean bg-ocean/5 text-ocean' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}">
						{group.label || '—'}
						<span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 font-normal">{group.available}</span>
					</button>
					{/each}
				</div>
				{#if addSelectedGroup}
					{#each Object.entries(addSelectedGroup.attrs) as [key, val]}
						{#if val}<input type="hidden" name="attrKey" value={key} /><input type="hidden" name="attrVal" value={val} />{/if}
					{/each}
				{/if}
			</div>
			{/if}

			<!-- Quantity stepper — always shown once variant selected (or if no variants) -->
			{#if !addAttrEntries.length || addSelectedGroup}
			<div class="flex items-center gap-3">
				<label class="text-xs font-medium text-gray-600">Cantidad</label>
				<div class="flex items-center gap-2">
					<button type="button" onclick={() => addAllocQty = Math.max(1, addAllocQty - 1)}
						class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">−</button>
					<span class="w-6 text-center text-sm font-semibold">{addAllocQty}</span>
					<button type="button" onclick={() => addAllocQty = Math.min(availCount, addAllocQty + 1)}
						class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-100">+</button>
				</div>
				{#if availCount === 0}
					<span class="text-xs text-red-500">Sin stock</span>
				{:else}
					<span class="text-xs text-muted">{availCount} disponibles</span>
				{/if}
			</div>
			<input type="hidden" name="quantity" value={addAllocQty} />
			<div class="flex gap-2">
				<button type="submit" disabled={addAllocQty < 1 || availCount === 0}
					class="rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white hover:bg-ocean/90 disabled:opacity-40">
					Añadir {addAllocQty}
				</button>
				<button type="button" onclick={() => { addingAlloc = false; addAllocSelectedGroup = null; addAllocQty = 1; }}
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
			</div>
			{/if}
		</form>
		{/if}

		<!-- Existing allocations -->
		{#if data.booking.allocations.length > 0}
		<ul class="divide-y divide-gray-100">
			{#each data.booking.allocations as alloc}
			<li class="flex items-center justify-between gap-3 px-4 py-3">
				<div class="min-w-0">
					<p class="text-sm font-medium text-gray-900">
						{alloc.quantity}× {alloc.itemTypeName}
					</p>
					{#if alloc.attributeFilter && Object.keys(alloc.attributeFilter).length > 0}
						<div class="mt-0.5 flex flex-wrap gap-1">
							{#each Object.values(alloc.attributeFilter) as v}
								<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{v}</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<form method="POST" action="?/updateAllocStatus" use:enhance={withToast()}>
						<input type="hidden" name="allocId" value={alloc.id} />
						<select name="status"
							onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
							class="rounded-lg border border-gray-300 px-2 py-1 text-xs {ALLOC_STATUS_COLORS[alloc.status] ?? ''}">
							{#each ALLOC_STATUS_OPTIONS as opt}
								<option value={opt.value} selected={alloc.status === opt.value}>{opt.label}</option>
							{/each}
						</select>
					</form>
					<form method="POST" action="?/removeAlloc" use:enhance={withToast()}>
						<input type="hidden" name="allocId" value={alloc.id} />
						<button type="submit"
							onclick={(e) => { if (!confirm('Remove this allocation?')) e.preventDefault(); }}
							class="rounded p-1 text-gray-400 hover:text-red-500">✕</button>
					</form>
				</div>
			</li>
			{/each}
		</ul>
		{:else if !addingAlloc}
		<p class="px-4 py-4 text-sm text-gray-400">No items allocated yet.</p>
		{/if}
	</div>
	{/if}

	<!-- ── Clients & Payment ─────────────────────────────────────────────────── -->
	<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
		<!-- Header row -->
		<div class="flex items-center justify-between px-4 pt-4 pb-3">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">
				{m.booking_detail_clients_payment()}
				{#if hasRoster && maxCapacity != null}
					<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
						{enrolled} / {maxCapacity}
					</span>
				{/if}
			</p>
			{#if hasRoster && (slotsLeft == null || slotsLeft > 0) && data.booking.status !== 'cancelled'}
				<button type="button" onclick={() => { selectedEnroll = null; enrollPanel = false; enrollSearch = ''; }}
					class="text-xs font-medium text-ocean hover:underline">{m.booking_detail_enroll()}</button>
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
						<input type="hidden" name="amountDue" value={data.booking.priceOverride ?? data.booking.serviceBasePrice ?? '0'} />
						<button type="submit" class="btn-primary btn-sm">{m.booking_detail_enroll()}</button>
						<button type="button" onclick={() => selectedEnroll = null} class="text-xs text-muted hover:text-gray-700">✕</button>
					</form>
				{:else if !enrollPanel}
					<div class="relative">
						<input type="text" placeholder={m.booking_detail_search_student()} bind:value={enrollSearch}
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
										{m.booking_new_create_client()} "<span class="font-medium">{enrollSearch}</span>"
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
						<p class="text-xs font-semibold text-ocean">{m.booking_new_add_client()}</p>
						<div class="grid grid-cols-2 gap-2">
							<input bind:value={newFirstName} placeholder={m.client_new_first_name()} class="rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
							<input bind:value={newLastName} placeholder={m.common_name()} class="rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						</div>
						<input bind:value={newPhone} type="tel" placeholder={m.common_phone()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<input bind:value={newEmail} type="email" placeholder={m.common_email()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm focus:border-ocean focus:outline-none" />
						<div class="flex gap-2 pt-1">
							<button type="button" onclick={saveNewEnrollClient} disabled={!newFirstName || creatingClient}
								class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
								{creatingClient ? m.booking_new_saving() : m.booking_detail_add_select()}
							</button>
							<button type="button" onclick={() => { enrollPanel = false; enrollSearch = ''; }}
								class="rounded-md px-3 py-2 text-xs text-muted ring-1 ring-border">{m.common_cancel()}</button>
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
								class="btn-secondary btn-sm btn-block gap-1.5"><Bell size={13} /> {m.booking_detail_send_reminder()}</a>
						{/if}
					</div>
					{#if canSeeFinancials}
					<form method="post" action="?/updatePayment" use:enhance={withToast()} class="space-y-2">
						<input type="hidden" name="bookingClientId" value={bc.id} />
						<input type="hidden" name="amountDue" value={bc.amountDue} />
						<div class="flex items-end gap-2">
							<div class="flex-1">
								<label class="text-xs text-muted">{m.booking_detail_paid_of()} €{bc.amountDue}</label>
								<input name="amountPaid" type="number" step="0.01" min="0" value={bc.amountPaid}
									class="mt-0.5 input" />
							</div>
							<button type="submit" class="btn-secondary btn-sm">{m.booking_detail_save_payment()}</button>
						</div>
					</form>
					<form method="post" action="?/updateAmountDue" use:enhance={withToast()} class="flex items-end gap-2">
						<input type="hidden" name="bookingClientId" value={bc.id} />
						<div class="flex-1">
							<label class="text-xs text-muted">Precio a cobrar (€)</label>
							<input name="amountDue" type="number" step="0.01" min="0" value={bc.amountDue}
								class="mt-0.5 input" />
						</div>
						<button type="submit" class="btn-secondary btn-sm">Fijar</button>
					</form>
					{/if}
					{#if bc.status === 'enrolled' && data.booking.status !== 'cancelled'}
						<form method="post" action="?/cancelClient" use:enhance={withToast()} class="mt-2">
							<input type="hidden" name="bookingClientId" value={bc.id} />
							<button type="submit"
								onclick={(e) => { if (!confirm('Remove this client?')) e.preventDefault(); }}
								class="text-xs text-muted hover:text-red-500">{m.booking_detail_remove()}</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>

		{#if cancelledClients.length > 0}
			<details class="border-t border-border/50">
				<summary class="cursor-pointer px-4 py-2.5 text-xs text-muted hover:text-gray-600">
					{m.booking_detail_cancelled_label()} ({cancelledClients.length})
				</summary>
				<div class="divide-y divide-border/60 pb-2">
					{#each cancelledClients as bc}
						<div class="flex items-center justify-between px-4 py-2.5 opacity-60">
							<span class="text-sm text-gray-500 line-through">{bc.clientFirstName} {bc.clientLastName}</span>
							<form method="post" action="?/reenrollClient" use:enhance={withToast()}>
								<input type="hidden" name="bookingClientId" value={bc.id} />
								<button type="submit" class="text-xs text-ocean hover:underline">{m.booking_detail_reenroll()}</button>
							</form>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	</div>

	<!-- Participants (who's actually doing the activity) -->
	{#if data.booking.serviceHasSessions || data.booking.serviceHasRoster}
		<section class="mb-4 rounded-(--radius-card) bg-surface p-5 ring-1 ring-border">
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{m.booking_detail_participants()}</h2>
			<p class="mb-3 text-xs text-muted">{m.booking_detail_participants_hint()}</p>

			{#if data.booking.participants.length > 0}
				<ul class="mb-3 space-y-1.5">
					{#each data.booking.participants as p}
						<li class="flex items-center justify-between">
							<span class="text-sm text-gray-800">{p.name}</span>
							<form method="POST" action="?/removeBookingParticipant" use:enhance={withToast()}>
								<input type="hidden" name="participantId" value={p.id} />
								<button type="submit" class="text-xs text-muted hover:text-red-500">✕</button>
							</form>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mb-3 text-xs text-muted">{m.booking_detail_no_participants()}</p>
			{/if}

			<form method="POST" action="?/addBookingParticipant" use:enhance={withToast()} class="flex flex-col gap-2">
				<div class="flex gap-2">
					<input name="name" type="text" placeholder={m.booking_detail_add_participant()} class="input input-sm flex-1" />
					<button type="submit" class="btn-primary btn-sm">{m.common_add()}</button>
				</div>
				<label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
					<input type="checkbox" name="addToSessions" value="true" class="h-3.5 w-3.5" />
					{m.booking_detail_add_to_sessions()}
				</label>
			</form>
		</section>
	{/if}

	<!-- ── Sessions ─────────────────────────────────────────────────────────── -->
	{#if hasSessions}
		<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-4 pt-4 pb-3">
				<div class="border-l-2 border-ocean pl-2">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted">
						{m.booking_detail_sessions()}
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
						<p class="mt-0.5 text-[11px] text-amber-600">{unscheduledSessions.length} {m.booking_detail_needs_time()}</p>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if hasDateRange}
						<button type="button" onclick={() => { showBulkGenerate = !showBulkGenerate; showAddSession = false; }}
							class="text-xs font-medium text-muted hover:text-slate-700">
							{showBulkGenerate ? m.common_cancel() : m.booking_detail_session_generate()}
						</button>
					{/if}
					<button type="button" onclick={() => { showAddSession = !showAddSession; showBulkGenerate = false; }}
						class="text-xs font-medium text-ocean hover:underline">
						{showAddSession ? m.common_cancel() : m.booking_detail_session_add()}
					</button>
				</div>
			</div>

			{#if showBulkGenerate}
				<form method="post" action="?/bulkGenerateSessions"
					use:enhance={withToast(() => { showBulkGenerate = false; })}
					class="mx-4 mb-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
					<p class="text-xs font-semibold text-amber-800">{m.booking_detail_generate_for({ start: data.booking.date, end: data.booking.dateEnd ?? '' })}</p>
					<div>
						<label class="text-xs text-muted">{m.booking_detail_sessions_per_day()}</label>
						<input name="sessionsPerDay" type="number" min="1" max="6" bind:value={bulkSessionsPerDay}
							class="mt-0.5 input text-xs w-24" />
					</div>
					<div class="space-y-1">
						<label class="text-xs text-muted">{m.booking_detail_sessions_times()}</label>
						{#each bulkTimes as _, i}
							<input name="sessionTime_{i}" type="time" bind:value={bulkTimes[i]} class="mt-0.5 input text-xs" />
						{/each}
					</div>
					<label class="flex cursor-pointer items-center gap-2">
						<input type="checkbox" name="weekdaysOnly" class="h-3.5 w-3.5 accent-ocean" />
						<span class="text-xs text-gray-700">{m.booking_detail_weekdays_only()}</span>
					</label>
					{#if data.sessions.length > 0}
						<label class="flex cursor-pointer items-center gap-2">
							<input type="checkbox" name="clearExisting" class="h-3.5 w-3.5 accent-red-500" />
							<span class="text-xs text-red-600">{m.booking_detail_clear_existing()}</span>
						</label>
					{/if}
					<button type="submit" class="btn-primary btn-sm btn-block">{m.booking_detail_generate_sessions()}</button>
				</form>
			{/if}

			{#if showAddSession}
				<form method="post" action="?/addSession" use:enhance={withToast(() => { showAddSession = false; })}
					class="mx-4 mb-3 space-y-2 rounded-lg border border-ocean/30 bg-ocean/5 p-3">
					<p class="text-xs font-semibold text-ocean">{m.booking_detail_session_new()}</p>
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs text-muted">{m.booking_detail_session_date()}</label>
							<input name="sessionDate" type="date" required value={data.booking.date} class="mt-0.5 input text-xs" />
						</div>
						<div>
							<label class="text-xs text-muted">{m.booking_detail_session_time()}</label>
							<input name="sessionTime" type="time" bind:value={addFormTime} class="mt-0.5 input text-xs" />
						</div>
						<div>
							<label class="text-xs text-muted">{m.booking_detail_session_duration()}</label>
							<input name="sessionDuration" type="number" min="15" step="15" bind:value={addFormDuration}
								class="mt-0.5 input text-xs" />
						</div>
					</div>
					<div>
						<label class="text-xs text-muted">{m.booking_detail_session_notes()}</label>
						<input name="sessionNotes" placeholder={m.booking_detail_session_notes_placeholder()} class="mt-0.5 input text-xs" />
					</div>
					{#if data.instructors.length > 0}
						<div>
							<label class="text-xs text-muted mb-1 block">{m.booking_detail_session_instructors()}</label>
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
					<button type="submit" class="btn-primary btn-sm btn-block">{m.booking_detail_session_save()}</button>
				</form>
			{/if}

			<!-- Session timeline -->
			{#if data.sessions.length === 0}
				<p class="px-4 pb-4 text-sm text-muted">
					{data.booking.sessionsIncluded != null
						? `${data.booking.sessionsIncluded} session${data.booking.sessionsIncluded > 1 ? 's' : ''} to schedule — tap + Add.`
						: hasDateRange ? m.booking_detail_no_sessions() : 'No sessions yet.'}
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
														<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{m.booking_detail_session_unscheduled()}</span>
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
												{#if session.skillLevel}
													{@const levelLabel = session.skillLevel === 'beginner'
														? m.skill_level_beginner()
														: session.skillLevel === 'intermediate'
															? m.skill_level_intermediate()
															: m.skill_level_advanced()}
													<span class="rounded-full bg-ocean/10 px-2 py-0.5 text-xs font-medium text-ocean">
														{levelLabel}
													</span>
												{/if}
												<button type="button"
													onclick={() => editingSessionId = editingSessionId === session.id ? null : session.id}
													class="btn-ghost btn-sm p-1 text-xs">{m.booking_detail_session_edit()}</button>
												<form method="post" action="?/cancelSession" use:enhance={withToast()}>
													<input type="hidden" name="sessionId" value={session.id} />
													<button type="submit"
														onclick={(e) => { if (!confirm(m.booking_detail_session_cancel_confirm())) e.preventDefault(); }}
														class="btn-destructive btn-sm p-1 text-xs">✕</button>
												</form>
											</div>
										</div>

										<!-- Participants -->
										<div class="mt-2 border-t border-border/40 pt-2">
											<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{m.booking_detail_session_attending()}</p>
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
												<p class="text-xs italic text-muted">{m.booking_detail_session_defaults_to_client()}</p>
											{/if}
											<form method="post" action="?/addParticipant" use:enhance={withToast()} class="mt-1.5 flex gap-2">
												<input type="hidden" name="sessionId" value={session.id} />
												<input name="participantName" placeholder={m.booking_detail_add_session_participant()} class="input input-sm flex-1 text-xs" />
												<button type="submit" class="btn-ghost btn-sm text-xs">{m.booking_detail_session_add()}</button>
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
														<label class="text-xs text-muted">{m.booking_detail_session_time()}</label>
														<input name="sessionTime" type="time" bind:value={editFormTime}
															class="mt-0.5 input text-xs" />
													</div>
													<div>
														<label class="text-xs text-muted">{m.booking_detail_session_duration()}</label>
														<input name="sessionDuration" type="number" min="15" step="15"
															bind:value={editFormDuration}
															class="mt-0.5 input text-xs" />
													</div>
													<div class="col-span-2">
														<label class="text-xs text-muted">{m.booking_detail_session_notes()}</label>
														<input name="sessionNotes" value={session.notes ?? ''}
															class="mt-0.5 input text-xs" />
													</div>
													<div class="col-span-2">
														<label class="text-xs text-muted">{m.booking_detail_session_level()}</label>
														<div class="mt-0.5 flex gap-1.5">
															{#each [
																{ value: 'beginner', label: m.skill_level_beginner() },
																{ value: 'intermediate', label: m.skill_level_intermediate() },
																{ value: 'advanced', label: m.skill_level_advanced() }
															] as lvl}
																<button
																	type="button"
																	onclick={() => { editSessionLevel = editSessionLevel === lvl.value ? '' : lvl.value; }}
																	class="flex-1 rounded border py-1 text-[10px] font-medium
																		{editSessionLevel === lvl.value
																		? 'border-ocean bg-ocean/10 text-ocean'
																		: 'border-border text-muted hover:border-ocean/40'}"
																>
																	{lvl.label}
																</button>
															{/each}
														</div>
														<input type="hidden" name="sessionLevel" value={editSessionLevel} />
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
												<button type="submit" class="btn-primary btn-sm btn-block">{m.booking_detail_session_save()}</button>
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

	{#if data.booking.status === 'cancelled' && (data.userRole === 'owner' || data.userRole === 'admin')}
		{@const hasPaid = data.booking.clients.some(c => parseFloat(c.amountPaid) > 0)}
		{#if !hasPaid}
			<form method="post" action="?/delete" use:enhance={withToast()}>
				<button type="submit"
					onclick={(e) => { if (!confirm('Permanently delete this booking and all its sessions? This cannot be undone.')) e.preventDefault(); }}
					class="btn-block w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100">
					Delete booking permanently
				</button>
			</form>
		{/if}
	{/if}

	{#if data.booking.serviceId}
		<a href="/services/{data.booking.serviceId}" class="btn-secondary btn-block text-center text-sm">
			→ Service settings
		</a>
	{/if}

</div>
