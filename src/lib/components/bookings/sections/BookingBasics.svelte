<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	type Service = {
		id: string;
		name: string;
		basePrice: string;
		hasSessions: boolean;
		hasRoster: boolean;
		hasDateRange: boolean;
		hasInventoryUnits: boolean;
		requiresInstructor: boolean;
		defaultSessionsIncluded: number | null;
	};
	type Client = { id: string; firstName: string; lastName: string; phone: string | null };

	let {
		services,
		clients,
		selectedServiceId = $bindable(''),
		sessionsIncluded = $bindable(1),
		participantMode = $bindable<'count' | 'names'>('count'),
		participantCount = $bindable(1),
		participantNames = $bindable<string[]>([]),
		selectedClients = $bindable<Array<{ clientId: string; name: string; amountDue: string }>>([]),
		clientSearch = $bindable('')
	}: {
		services: Service[];
		clients: Client[];
		selectedServiceId?: string;
		sessionsIncluded?: number;
		participantMode?: 'count' | 'names';
		participantCount?: number;
		participantNames?: string[];
		selectedClients?: Array<{ clientId: string; name: string; amountDue: string }>;
		clientSearch?: string;
	} = $props();

	const selectedService = $derived(services.find((s) => s.id === selectedServiceId));
	const isLesson = $derived(!!(selectedService?.hasSessions && !selectedService?.hasRoster));

	const filteredClients = $derived(
		clientSearch.length > 1
			? clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) &&
						!selectedClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);

	function addClient(client: Client) {
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

	function addParticipantField() {
		participantNames = [...participantNames, ''];
	}

	function removeParticipantField(i: number) {
		participantNames = participantNames.filter((_, idx) => idx !== i);
	}

	$effect(() => {
		if (selectedService?.defaultSessionsIncluded) {
			sessionsIncluded = selectedService.defaultSessionsIncluded;
		}
	});
</script>

<div class="space-y-4">
	<!-- Service -->
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_service()}
		</label>
		<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
			{#each services as s}
				<option value={s.id}>{s.name} — €{s.basePrice}</option>
			{/each}
		</select>
	</div>

	<!-- Sessions included (lesson only) -->
	{#if isLesson}
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
						<button
							type="button"
							onclick={() => removeParticipantField(i)}
							class="text-muted hover:text-red-500"
						>✕</button>
					</div>
				{/each}
				<button
					type="button"
					onclick={addParticipantField}
					class="text-sm text-ocean hover:underline"
				>
					{m.booking_new_add_participant()}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Client (payer) — lesson mode only -->
	{#if isLesson}
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_new_clients()}
			</label>
			<div class="relative">
				<input
					type="text"
					bind:value={clientSearch}
					placeholder={m.booking_new_client_search()}
					autocomplete="off"
					class="input w-full"
				/>
				{#if filteredClients.length > 0}
					<ul class="absolute z-10 mt-1 w-full rounded-(--radius-card) border border-border bg-white shadow-lg">
						{#each filteredClients as c}
							<li>
								<button
									type="button"
									onclick={() => addClient(c)}
									class="w-full px-3 py-2 text-left text-sm hover:bg-ocean/5"
								>
									{c.firstName} {c.lastName}
									{#if c.phone}<span class="text-muted"> · {c.phone}</span>{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#each selectedClients as sc, i}
				<div class="mt-2 flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
					<span>{sc.name}</span>
					<div class="flex items-center gap-2">
						<span class="text-muted">€</span>
						<input
							type="number"
							name="amountDue"
							bind:value={selectedClients[i].amountDue}
							step="0.01"
							min="0"
							class="w-20 rounded border border-border px-1 py-0.5 text-right text-sm"
						/>
						<input type="hidden" name="clientId" value={sc.clientId} />
						<button type="button" onclick={() => removeClient(sc.clientId)} class="text-muted hover:text-red-500">✕</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
