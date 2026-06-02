<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import { Zap } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type FilterTab = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'unscheduled';
	let statusFilter = $state<FilterTab>('all');
	let search = $state('');

	const needsSchedulingCount = $derived(
		data.bookings.filter(b => b.serviceHasSessions && b.sessionCount > 0 && b.scheduledCount < b.sessionCount && b.status !== 'cancelled').length
	);

	const filtered = $derived(
		data.bookings.filter(b => {
			if (statusFilter === 'unscheduled')
				return b.serviceHasSessions && b.sessionCount > 0 && b.scheduledCount < b.sessionCount && b.status !== 'cancelled';
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
	<div class="border-b border-border px-4 py-2.5 space-y-2">
		<input
			bind:value={search}
			placeholder="Search client or service…"
			class="input input-sm w-full text-sm"
		/>
		<div class="flex gap-1 overflow-x-auto pb-0.5">
			{#each (['all', 'pending', 'confirmed', 'cancelled'] as const) as s}
				<button
					onclick={() => statusFilter = s}
					class="shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors
					       {statusFilter === s ? 'bg-ocean text-white' : 'bg-surface text-muted ring-1 ring-border hover:text-gray-700'}"
				>{s}</button>
			{/each}
			{#if needsSchedulingCount > 0}
				<button
					onclick={() => statusFilter = 'unscheduled'}
					class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors
					       {statusFilter === 'unscheduled' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'}"
				>
					<Zap size={11} class="inline mr-0.5" />needs scheduling ({needsSchedulingCount})
				</button>
			{/if}
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
