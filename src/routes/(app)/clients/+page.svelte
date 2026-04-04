<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let search = $state(data.search ?? '');

	const skillColors: Record<string, string> = {
		beginner: 'bg-blue-100 text-blue-700',
		intermediate: 'bg-amber-100 text-amber-700',
		advanced: 'bg-green-100 text-green-700'
	};

	function handleSearch() {
		const params = search ? `?q=${encodeURIComponent(search)}` : '';
		goto(`/clients${params}`, { replaceState: true });
	}
</script>

<div class="p-4 md:p-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Clients</h1>
		<a
			href="/clients/new"
			class="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-ocean/90"
		>
			+ New
		</a>
	</div>

	<input
		type="search"
		placeholder="Search by name or phone…"
		bind:value={search}
		oninput={handleSearch}
		class="mb-4 w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
	/>

	<div class="space-y-2">
		{#each data.clients as client}
			<a
				href="/clients/{client.id}"
				class="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-bold text-navy"
				>
					{client.firstName[0]}{client.lastName[0]}
				</div>
				<div class="min-w-0 flex-1">
					<p class="font-medium text-gray-800">{client.firstName} {client.lastName}</p>
					{#if client.phone}
						<p class="truncate text-xs text-muted">{client.phone}</p>
					{/if}
				</div>
				{#if client.skillLevel}
					<span
						class="rounded-full px-2 py-0.5 text-xs font-medium {skillColors[client.skillLevel]}"
					>
						{client.skillLevel}
					</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if data.clients.length === 0}
		<p class="py-12 text-center text-sm text-muted">
			{data.search ? `No clients matching "${data.search}"` : 'No clients yet.'}
		</p>
	{/if}
</div>
