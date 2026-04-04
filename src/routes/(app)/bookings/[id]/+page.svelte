<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
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

	// Editable scheduling fields (untrack: initial values only, not reactive to server refreshes)
	let editingSchedule = $state(false);
	let editDate = $state(untrack(() => data.booking.date));
	let editTime = $state(untrack(() => data.booking.time?.slice(0, 5) ?? ''));
	let editFlexible = $state(untrack(() => data.booking.isFlexible));
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<!-- Header -->
	<div class="mb-5 flex items-start gap-3">
		<a href="/calendar" class="mt-1 text-muted hover:text-gray-700">←</a>
		<div class="flex-1">
			<h1 class="text-xl font-bold text-navy">{data.booking.serviceName}</h1>
			{#if !editingSchedule}
				<p class="text-sm text-muted">
					{data.booking.date}
					{#if data.booking.time} · {data.booking.time.slice(0, 5)}{/if}
					{#if data.booking.isFlexible} <span class="text-flexible">⚡ flexible</span>{/if}
				</p>
			{/if}
		</div>
		<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
			{data.booking.status}
		</span>
	</div>

	<!-- Schedule edit (date / time / flexible) -->
	<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
		<div class="mb-2 flex items-center justify-between">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">Date & time</p>
			<button
				type="button"
				onclick={() => {
					editDate = data.booking.date;
					editTime = data.booking.time?.slice(0, 5) ?? '';
					editFlexible = data.booking.isFlexible;
					editingSchedule = !editingSchedule;
				}}
				class="text-xs text-ocean hover:underline"
			>{editingSchedule ? 'Cancel' : 'Edit'}</button>
		</div>

		{#if editingSchedule}
			<form
				method="post"
				action="?/update"
				use:enhance={() => { return async ({ update }) => { editingSchedule = false; update(); }; }}
				class="space-y-3"
			>
				<!-- Pass instructor so it doesn't get wiped -->
				<input type="hidden" name="instructorId" value={data.booking.instructorId ?? ''} />
				<input type="hidden" name="status" value={data.booking.status} />
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted">Date</label>
						<input
							name="date"
							type="date"
							bind:value={editDate}
							required
							class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs text-muted">Time</label>
						<input
							name="time"
							type="time"
							bind:value={editTime}
							disabled={editFlexible}
							class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40"
						/>
					</div>
				</div>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						name="isFlexible"
						bind:checked={editFlexible}
						class="h-4 w-4 accent-ocean"
					/>
					⚡ Flexible time
				</label>
				<button
					type="submit"
					class="w-full rounded-lg bg-ocean py-2 text-sm font-semibold text-white hover:bg-ocean/90"
				>Save schedule</button>
			</form>
		{:else}
			<p class="text-sm text-gray-800">
				{data.booking.date}{data.booking.time ? ' · ' + data.booking.time.slice(0, 5) : ''}
				{#if data.booking.isFlexible}<span class="ml-1 text-flexible">⚡ flexible</span>{/if}
			</p>
		{/if}
	</div>

	<!-- Instructor -->
	<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
		<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Instructor</p>
		<form method="post" action="?/update" use:enhance>
			<!-- Carry all current values so nothing gets wiped -->
			<input type="hidden" name="date" value={data.booking.date} />
			<input type="hidden" name="time" value={data.booking.time ?? ''} />
			<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
			<input type="hidden" name="status" value={data.booking.status} />
			<select
				name="instructorId"
				onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()}
				class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">— unassigned —</option>
				{#each data.instructors as instructor}
					<option value={instructor.id} selected={data.booking.instructorId === instructor.id}>
						{instructor.name}
					</option>
				{/each}
			</select>
		</form>
	</div>

	<!-- Clients + Payment -->
	<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
		<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Clients & Payment</p>
		<div class="space-y-3">
			{#each data.booking.clients as bc}
				<div class="space-y-2">
					<p class="text-sm font-medium text-gray-800">
						{bc.clientFirstName} {bc.clientLastName}
					</p>
					<form method="post" action="?/updatePayment" use:enhance class="flex items-center gap-2">
						<input type="hidden" name="bookingClientId" value={bc.id} />
						<input type="hidden" name="amountDue" value={bc.amountDue} />
						<div class="flex-1">
							<label class="text-xs text-muted">Paid (of €{bc.amountDue})</label>
							<input
								name="amountPaid"
								type="number"
								step="0.01"
								min="0"
								max={bc.amountDue}
								value={bc.amountPaid}
								class="mt-0.5 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
							/>
						</div>
						<div class="pt-4">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {paymentColors[bc.paymentStatus]}">
								{bc.paymentStatus}
							</span>
						</div>
						<button type="submit" class="mt-4 rounded-lg bg-ocean/10 px-3 py-2 text-xs font-medium text-ocean hover:bg-ocean/20">
							Save
						</button>
					</form>
				</div>
			{/each}
		</div>
	</div>

	<!-- Notes -->
	{#if data.booking.spotNotes || data.booking.notes}
		<div class="mb-4 space-y-1 rounded-(--radius-card) bg-surface p-4 text-sm ring-1 ring-border">
			{#if data.booking.spotNotes}<p class="text-muted">📍 {data.booking.spotNotes}</p>{/if}
			{#if data.booking.notes}<p class="text-muted">📝 {data.booking.notes}</p>{/if}
		</div>
	{/if}

	<!-- Actions: Confirm + Cancel -->
	<div class="flex gap-3">
		{#if data.booking.status !== 'confirmed'}
			<form method="post" action="?/update" use:enhance class="flex-1">
				<input type="hidden" name="status" value="confirmed" />
				<input type="hidden" name="date" value={data.booking.date} />
				<input type="hidden" name="time" value={data.booking.time ?? ''} />
				<input type="hidden" name="isFlexible" value={String(data.booking.isFlexible)} />
				<input type="hidden" name="instructorId" value={data.booking.instructorId ?? ''} />
				<button type="submit" class="w-full rounded-lg bg-confirmed py-2.5 text-sm font-semibold text-white hover:opacity-90">
					Confirm
				</button>
			</form>
		{/if}
		{#if data.booking.status !== 'cancelled'}
			<form method="post" action="?/cancel" use:enhance class="flex-1">
				<button
					type="submit"
					onclick={(e) => { if (!confirm('Cancel this booking?')) e.preventDefault(); }}
					class="w-full rounded-lg py-2.5 text-sm font-semibold ring-1 ring-flexible text-flexible hover:bg-flexible/5"
				>
					Cancel
				</button>
			</form>
		{/if}
	</div>

	{#if form?.error}
		<p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
	{/if}
</div>
