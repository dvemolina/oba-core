<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import type { BookingClient } from '$lib/features/bookings/types';
	import ContactButtons from '$lib/components/ContactButtons.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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
	const maxStudents = $derived(data.booking.serviceMaxStudents);
	const slotsLeft = $derived(maxStudents != null ? maxStudents - enrolled : null);
	const fillPct = $derived(maxStudents ? Math.round((enrolled / maxStudents) * 100) : 0);

	// Per-client editing state
	let expandedClientId = $state<string | null>(null);

	function whatsappUrl(bc: BookingClient): string {
		const service = data.booking.serviceName ?? 'tu reserva';
		const date = data.booking.date;
		const time = data.booking.time ? ` a las ${data.booking.time.slice(0, 5)}` : '';
		return `¡Hola ${bc.clientFirstName}! Te escribimos desde OBA para recordarte: ${service} el ${date}${time}. ¿Confirmas tu asistencia? 🏄`;
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">

	{#if data.isCamp}
	<!-- ══════════════════════════ CAMP ROSTER ══════════════════════════════ -->

		<!-- Header -->
		<div class="mb-5 flex items-start gap-3">
			<a href="/calendar" class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
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
					{enrolled}{maxStudents != null ? ` / ${maxStudents}` : ''} students
				</span>
			</div>
			{#if maxStudents != null}
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
		{#if data.service?.campInstructorIds?.length}
			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Instructors</p>
				<div class="flex flex-wrap gap-2">
					{#each data.instructors.filter((i) => data.service?.campInstructorIds?.includes(i.id)) as instructor}
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
			<a href="/calendar" class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
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
					<!-- Instructor -->
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-wider text-muted">Instructor</span>
						<span class="text-sm text-gray-800">{data.booking.instructorName ?? '—'}</span>
					</div>
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
							<div class="mb-3">
								<ContactButtons phone={bc.clientPhone} email={bc.clientEmail} whatsappMessage={whatsappUrl(bc)} />
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
						<div>
							<label class="mb-1 block text-xs text-muted">Time</label>
							<input name="time" type="time" bind:value={editTime} disabled={editFlexible}
								class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
						</div>
					</div>
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
