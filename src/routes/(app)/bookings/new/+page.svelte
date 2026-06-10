<script lang="ts">
	import { untrack } from 'svelte';
	import { Zap } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import NotesSection from '$lib/components/bookings/sections/NotesSection.svelte';
	import ClientSearchInput from '$lib/components/ClientSearchInput.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	// ── Service selection ──────────────────────────────────────────────────────
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));
	const isCamp        = $derived(!!(selectedService?.hasRoster && selectedService?.hasDateRange));
	const isLesson      = $derived(!!(selectedService?.hasSessions && !isCamp));
	const isAccommodation = $derived(!!selectedService?.hasInventoryUnits);
	const inventoryPricingMode = $derived(selectedService?.pricingMode ?? null);
	const inventoryNeedsDateRange = $derived(
		inventoryPricingMode === 'per_night' || inventoryPricingMode === 'per_day' ||
		inventoryPricingMode === 'per_unit_per_day' || inventoryPricingMode === 'per_person_per_day'
	);
	const runs = $derived(selectedService ? (data.runsByService[selectedService.id] ?? []) : []);
	const showInstructor = $derived(
		!isLesson && !isCamp && !isAccommodation && (selectedService?.requiresInstructor ?? false)
	);

	// ── Dates ─────────────────────────────────────────────────────────────────
	let date         = $state(data.defaultDate ?? '');
	let time         = $state(data.defaultTime ?? '');
	let isFlexible   = $state((data.defaultTime ?? '') === '');
	let invCheckIn   = $state('');
	let invCheckOut  = $state('');
	let selectedRunId = $state('');
	const selectedRun = $derived(runs.find((r) => r.id === selectedRunId));

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
			: selectedService?.basePrice ?? '0'
	);

	// Keep client amounts in sync for accommodation when dates change
	$effect(() => {
		if (isAccommodation) {
			const amt = invCalculatedAmount;
			untrack(() => { selectedClients = selectedClients.map(c => ({ ...c, amountDue: amt })); });
		}
	});

	// ── Instructor ─────────────────────────────────────────────────────────────
	let instructorId = $state('');

	// ── Notes ─────────────────────────────────────────────────────────────────
	let notesOpen = $state(false);
	let spotNotes = $state('');
	let notes     = $state('');

	// ── Clients ────────────────────────────────────────────────────────────────
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);

	function addClient(client: { id: string; firstName: string; lastName: string }) {
		const price = isAccommodation ? invCalculatedAmount : (selectedService?.basePrice ?? '0');
		selectedClients = [
			...selectedClients,
			{ clientId: client.id, name: `${client.firstName} ${client.lastName}`.trim(), amountDue: price }
		];
	}
	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter(c => c.clientId !== clientId);
	}
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-bold text-navy">{m.booking_new_title()}</h1>
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
					toast(d.message ?? m.booking_new_title());
					if (d.multiDay) await goto(`/calendar?date=${d.date}`);
					else if (d.bookingId) await goto(`/bookings/${d.bookingId}?new=1`);
				} else if (result.type === 'failure') {
					if ((result.data as any)?.error) toast((result.data as any).error, 'error');
					await update();
				} else {
					await update();
				}
			};
		}}
	>
		<!-- ── Service ────────────────────────────────────────────────────────── -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-4">
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_service()}</label>
				<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
					{#each data.services as s}
						<option value={s.id}>{s.name} — €{s.basePrice}</option>
					{/each}
				</select>
			</div>

			<!-- ── Date fields (per service type) ─────────────────────────────── -->
			{#if isLesson}
				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
					<input type="date" name="date" bind:value={date} required class="input w-full" />
					<input type="hidden" name="isFlexible" value="on" />
					<p class="mt-1 text-xs text-muted">Sessions will be scheduled from the booking detail.</p>
				</div>

			{:else if isAccommodation}
				{#if inventoryNeedsDateRange}
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkin()}</label>
							<input name="date" type="date" required bind:value={invCheckIn}
								class="input w-full" />
						</div>
						<div>
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkout()}</label>
							<input name="dateEnd" type="date" required bind:value={invCheckOut}
								class="input w-full" />
						</div>
					</div>
					{#if invCheckIn && invCheckOut && invCheckIn < invCheckOut}
						<div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 text-sm">
							<span class="text-gray-600">{calcInventoryUnits()} {inventoryPricingMode === 'per_night' ? 'nights' : 'days'} × €{selectedService?.basePrice}</span>
							<span class="ml-auto font-semibold text-gray-900">= €{invCalculatedAmount}</span>
						</div>
					{/if}
				{:else}
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
						<input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
					</div>
				{/if}

			{:else if isCamp}
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

			{:else}
				<!-- Regular service -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
						<input type="date" name="date" bind:value={date} required class="input w-full" />
					</div>
					<div>
						<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_time()}</label>
						<input type="time" name="time" bind:value={time} disabled={isFlexible} class="input w-full disabled:opacity-40" />
					</div>
				</div>
				<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
					<input type="checkbox" name="isFlexible" bind:checked={isFlexible} class="h-4 w-4 accent-ocean" />
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
			{/if}
		</div>

		<!-- ── Client ─────────────────────────────────────────────────────────── -->
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-2">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_clients()}</p>

			{#each selectedClients as c}
				<input type="hidden" name="clientId" value={c.clientId} />
				<input type="hidden" name="amountDue" value={c.amountDue} />
			{/each}

			{#if selectedClients.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each selectedClients as c}
						<div class="flex items-center gap-1 rounded-full bg-ocean/10 py-1 pl-3 pr-1">
							<span class="text-xs font-medium text-ocean">{c.name}</span>
							<button type="button" onclick={() => removeClient(c.clientId)}
								class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-ocean/60 hover:text-ocean">✕</button>
						</div>
					{/each}
				</div>
			{/if}

			<ClientSearchInput
				clients={data.clients}
				excludeIds={selectedClients.map(c => c.clientId)}
				placeholder={m.booking_new_client_search()}
				onSelect={(c) => addClient({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: null, email: null })}
			/>
		</div>

		<!-- ── Notes (collapsed) ──────────────────────────────────────────────── -->
		{#if !isCamp && !isAccommodation}
			<div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
				<button type="button" onclick={() => (notesOpen = !notesOpen)}
					class="flex w-full items-center justify-between px-4 py-3 text-left">
					<span class="text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_notes_section()}</span>
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
		{/if}

		<button type="submit" disabled={loading || selectedClients.length === 0}
			class="btn-primary btn-block mt-2">
			{loading ? m.booking_new_saving() : m.booking_new_accommodation()}
		</button>
	</form>
</div>
