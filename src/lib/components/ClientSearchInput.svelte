<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	type Client = { id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null };

	let {
		clients,
		excludeIds = [],
		onSelect,
		placeholder = ''
	}: {
		clients: Client[];
		excludeIds?: string[];
		/** Called with the selected client after search pick or new-client create. */
		onSelect: (client: { id: string; firstName: string; lastName: string }) => void;
		placeholder?: string;
	} = $props();

	let search       = $state('');
	let showPanel    = $state(false);
	let firstName    = $state('');
	let lastName     = $state('');
	let phone        = $state('');
	let email        = $state('');
	let creating     = $state(false);

	const filtered = $derived(
		search.length > 1
			? clients.filter(c =>
					`${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) &&
					!excludeIds.includes(c.id)
				).slice(0, 6)
			: []
	);
	const showCreate = $derived(search.length > 1 && filtered.length === 0 && !showPanel);

	function pick(c: Client) {
		onSelect({ id: c.id, firstName: c.firstName, lastName: c.lastName });
		search = '';
	}

	function openPanel() {
		const parts = search.trim().split(/\s+/);
		firstName = parts[0] ?? '';
		lastName  = parts.slice(1).join(' ');
		phone = ''; email = '';
		showPanel = true; search = '';
	}

	async function save() {
		if (!firstName) return;
		creating = true;
		try {
			const res = await fetch('/api/v1/clients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ firstName, lastName: lastName || '—', phone: phone || undefined, email: email || undefined })
			});
			const { data: client } = await res.json();
			onSelect({ id: client.id, firstName: client.firstName, lastName: client.lastName });
			showPanel = false;
		} finally { creating = false; }
	}
</script>

{#if !showPanel}
	<div class="relative">
		<input
			type="text"
			bind:value={search}
			{placeholder}
			autocomplete="off"
			class="input w-full"
		/>
		{#if filtered.length > 0 || showCreate}
			<div class="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border">
				{#each filtered as c}
					<button type="button" onclick={() => pick(c)}
						class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-sand">
						{c.firstName} {c.lastName}
						{#if c.phone}<span class="ml-2 text-xs text-muted">{c.phone}</span>{/if}
					</button>
				{/each}
				{#if showCreate}
					<button type="button" onclick={openPanel}
						class="w-full border-t border-border px-4 py-2.5 text-left text-sm text-ocean transition-colors hover:bg-sand">
						{m.booking_new_create_client()} "<span class="font-medium">{search}</span>"
					</button>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<div class="rounded-lg border border-ocean/30 bg-ocean/5 p-3 space-y-2">
		<p class="text-xs font-semibold text-ocean">{m.booking_new_add_client()}</p>
		<div class="grid grid-cols-2 gap-2">
			<input bind:value={firstName} placeholder={m.client_new_first_name()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
			<input bind:value={lastName}  placeholder={m.common_name()}            class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
		</div>
		<input bind:value={phone} type="tel"   placeholder={m.common_phone()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
		<input bind:value={email} type="email" placeholder={m.common_email()} class="w-full rounded-md border border-border px-2.5 py-2 text-sm" />
		<div class="flex gap-2 pt-1">
			<button type="button" onclick={save} disabled={!firstName || creating}
				class="flex-1 rounded-md bg-ocean py-2 text-xs font-semibold text-white disabled:opacity-50">
				{creating ? m.booking_new_saving() : m.common_add()}
			</button>
			<button type="button" onclick={() => { showPanel = false; search = ''; }} class="btn-ghost btn-sm">
				{m.common_cancel()}
			</button>
		</div>
	</div>
{/if}
