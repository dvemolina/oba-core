<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let statusFilter = $state<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
	let search = $state('');

	const filtered = $derived(
		data.bookings.filter(b => {
			if (statusFilter !== 'all' && b.status !== statusFilter) return false;
			if (search.length > 1) {
				const q = search.toLowerCase();
				const name = (b.firstClientName ?? '').toLowerCase();
				const svc = (b.serviceName ?? '').toLowerCase();
				if (!name.includes(q) && !svc.includes(q)) return false;
			}
			return true;
		})
	);

	function fmtDate(d: string) {
		return new Date(d + 'T00:00:00').toLocaleDateString('default', {
			day: 'numeric', month: 'short', year: 'numeric'
		});
	}

	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending: 'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="page-header">
		<h1 class="page-title">Bookings</h1>
		<a href="/bookings/new" class="btn btn-primary btn-sm">+ New</a>
	</div>

	<!-- Filters -->
	<div class="flex items-center gap-2 border-b border-border px-4 py-2.5">
		<input
			bind:value={search}
			placeholder="Search client or service…"
			class="input input-sm flex-1 text-sm"
		/>
		<div class="flex gap-1">
			{#each (['all', 'pending', 'confirmed', 'cancelled'] as const) as s}
				<button
					onclick={() => statusFilter = s}
					class="rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors
					       {statusFilter === s ? 'bg-ocean text-white' : 'bg-surface text-muted ring-1 ring-border hover:text-gray-700'}"
				>
					{s}
				</button>
			{/each}
		</div>
	</div>

	<!-- List -->
	<div class="flex-1 overflow-y-auto">
		{#if filtered.length === 0}
			<p class="py-16 text-center text-sm text-muted">No bookings found.</p>
		{:else}
			<div class="divide-y divide-border">
				{#each filtered as b}
					{@const c = getServiceColor(b.serviceColor ?? '')}
					<a
						href="/bookings/{b.id}"
						class="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
					>
						<div class="h-9 w-1 shrink-0 rounded-full {c.bg}"></div>

						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<p class="truncate text-sm font-semibold text-gray-900">
									{b.firstClientName ?? '—'}
								</p>
								<p class="truncate text-xs text-muted">{b.serviceName ?? 'Unknown service'}</p>
							</div>
							<div class="mt-0.5 flex items-center gap-2 text-xs text-muted">
								<span>{fmtDate(b.date)}</span>
								{#if b.serviceHasSessions && b.sessionCount > 0}
									<span>·</span>
									<span class="{b.scheduledCount < b.sessionCount ? 'text-amber-600' : 'text-green-600'}">
										{b.scheduledCount}/{b.sessionCount} sessions
									</span>
								{/if}
							</div>
						</div>

						<div class="flex shrink-0 flex-col items-end gap-1">
							<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {statusColors[b.status] ?? ''}">
								{b.status}
							</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
