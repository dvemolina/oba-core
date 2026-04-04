<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let isFlexible = $state(false);
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let clientSearch = $state('');

	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));

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
		selectedClients = [
			...selectedClients,
			{
				clientId: client.id,
				name: `${client.firstName} ${client.lastName}`,
				amountDue: selectedService?.basePrice ?? '0'
			}
		];
		clientSearch = '';
	}

	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}

	let creatingClient = $state(false);

	async function createAndAddClient(fullName: string) {
		const parts = fullName.trim().split(/\s+/);
		const firstName = parts[0] ?? fullName;
		const lastName = parts.slice(1).join(' ') || '—';

		creatingClient = true;
		try {
			const res = await fetch('/api/v1/clients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ firstName, lastName })
			});
			const { data: client } = await res.json();
			selectedClients = [
				...selectedClients,
				{
					clientId: client.id,
					name: `${client.firstName} ${client.lastName}`,
					amountDue: selectedService?.basePrice ?? '0'
				}
			];
			clientSearch = '';
		} finally {
			creatingClient = false;
		}
	}

	// Show "create new" when search has text but no existing client matches
	const showCreateNew = $derived(
		clientSearch.length > 1 && filteredClients.length === 0 && !creatingClient
	);
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/calendar" class="text-muted hover:text-gray-700">←</a>
		<h1 class="text-xl font-bold text-navy">New Booking</h1>
	</div>

	<form
		method="post"
		class="space-y-5"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				update();
			};
		}}
	>
		<!-- Date & Time -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Date *</label>
				<input
					name="date"
					type="date"
					required
					value={data.defaultDate}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Time</label>
				<input
					name="time"
					type="time"
					disabled={isFlexible}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none disabled:opacity-40"
				/>
			</div>
		</div>

		<!-- Flexible toggle -->
		<label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
			<input
				type="checkbox"
				name="isFlexible"
				bind:checked={isFlexible}
				class="h-4 w-4 accent-ocean"
			/>
			<div>
				<p class="text-sm font-medium text-gray-800">⚡ Flexible time</p>
				<p class="text-xs text-muted">Confirm based on surf conditions</p>
			</div>
		</label>

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

		<!-- Instructor -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Instructor</label>
			<select
				name="instructorId"
				class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
			>
				<option value="">— unassigned —</option>
				{#each data.instructors as instructor}
					<option value={instructor.id}>{instructor.name}</option>
				{/each}
			</select>
		</div>

		<!-- Clients -->
		<div>
			<label class="mb-1 block text-sm font-medium text-gray-700">Clients *</label>

			<!-- Selected chips -->
			{#if selectedClients.length > 0}
				<div class="mb-2 flex flex-wrap gap-2">
					{#each selectedClients as c}
						<div class="flex items-center gap-1 rounded-full bg-ocean/10 py-1 pl-3 pr-1">
							<span class="text-xs font-medium text-ocean">{c.name}</span>
							<input type="hidden" name="clientId" value={c.clientId} />
							<input type="hidden" name="amountDue" value={c.amountDue} />
							<button
								type="button"
								onclick={() => removeClient(c.clientId)}
								class="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-ocean/60 hover:text-ocean"
							>✕</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Search input -->
			<div class="relative">
				<input
					type="text"
					placeholder="Search or type name to add…"
					bind:value={clientSearch}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
				{#if filteredClients.length > 0 || showCreateNew}
					<div
						class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border"
					>
						{#each filteredClients.slice(0, 6) as client}
							<button
								type="button"
								onclick={() => addClient(client)}
								class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand"
							>
								{client.firstName}
								{client.lastName}
								{#if client.phone}<span class="ml-2 text-xs text-muted">{client.phone}</span>{/if}
							</button>
						{/each}
						{#if showCreateNew}
							<button
								type="button"
								onclick={() => createAndAddClient(clientSearch)}
								class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand"
							>
								+ Create "<span class="font-medium">{clientSearch}</span>"
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Notes -->
		<details class="group">
			<summary class="cursor-pointer text-sm text-muted hover:text-gray-700"
				>Notes & spot details ▸</summary
			>
			<div class="mt-3 space-y-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Spot / location notes</label>
					<input
						name="spotNotes"
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
						placeholder="e.g. Playa Norte, left peak"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Internal notes</label>
					<textarea
						name="notes"
						rows="2"
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
					></textarea>
				</div>
			</div>
		</details>

		{#if form?.error}
			<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={loading || selectedClients.length === 0}
			class="w-full rounded-lg bg-ocean py-3 text-sm font-semibold text-white hover:bg-ocean/90 disabled:opacity-60"
		>
			{loading ? 'Saving…' : 'Save Booking'}
		</button>
	</form>
</div>
