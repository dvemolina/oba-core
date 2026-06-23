<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import { getServiceColor } from '$lib/features/services/colors';
	import SessionListCard from '$lib/components/sessions/SessionListCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type S = PageData['byDate'][string][number];

	const sortedDates = $derived(Object.keys(data.byDate).sort());
	const totalCount = $derived(Object.values(data.byDate).reduce((acc, s) => acc + s.length, 0));

	function fmtDate(d: string) {
		return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
			weekday: 'long', day: 'numeric', month: 'long'
		});
	}
	function paidPct(s: S) {
		if (!s.totalAmountDue || s.totalAmountDue === 0) return 0;
		return Math.min(100, Math.round((s.totalAmountPaid / s.totalAmountDue) * 100));
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Header -->
	<div class="space-y-2 border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
		<div class="flex items-center justify-between gap-2">
			<h1 class="text-lg font-bold text-navy">Sesiones</h1>
			<p class="text-xs text-muted">{totalCount} sesión{totalCount !== 1 ? 'es' : ''}</p>
		</div>
		<form method="GET" class="flex flex-wrap items-center gap-2">
			<input type="date" name="from" value={data.from} class="input min-w-0 flex-1 text-sm"
				onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			<span class="text-xs text-muted">→</span>
			<input type="date" name="to" value={data.to} class="input min-w-0 flex-1 text-sm"
				onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			{#if data.uniqueServices.length > 1}
				<select name="service" class="input w-full text-sm sm:w-auto"
					onchange={(e) => e.currentTarget.form?.requestSubmit()}>
					<option value="">Todos los servicios</option>
					{#each data.uniqueServices as svc}
						<option value={svc} selected={svc === data.serviceFilter}>{svc}</option>
					{/each}
				</select>
			{/if}
		</form>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4 md:p-6">
		{#if sortedDates.length === 0}
			<div class="py-20 text-center text-sm text-muted">Sin sesiones en este período.</div>
		{:else}
			<div class="space-y-8">
				{#each sortedDates as date}
					{@const daySessions = data.byDate[date]}
					<section>
						<h2 class="mb-3 text-xs font-bold uppercase tracking-widest text-muted">{fmtDate(date)}</h2>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each daySessions as s (s.id)}
								{@const color = getServiceColor(s.serviceColor ?? '')}
								{@const paid = paidPct(s)}
								<SessionListCard
									session={s}
									{color}
									openHref="/sessions/{s.id}"
									updateAction="?/updateSession"
									cancelAction="?/cancelSession"
									hiddenFields={{ sessionId: s.id }}
									participantNames={s.participantNames}
								>
									{#snippet children()}
										<p class="truncate text-sm font-semibold text-gray-900">{s.serviceName ?? '—'}</p>
										{#if s.ownerType === 'booking' && s.firstClientName}
											<p class="text-xs font-medium text-ocean">
												<a href="/bookings/{s.bookingId}" class="hover:underline">{s.firstClientName}</a>
											</p>
										{:else if (s.enrolledCount ?? 0) > 0}
											<p class="text-[11px] text-muted">
												{s.enrolledCount} reserva{(s.enrolledCount ?? 0) !== 1 ? 's' : ''}
												{s.maxCapacity ? ` · ${s.enrolledCount}/${s.maxCapacity}` : ''}
											</p>
										{/if}
									{/snippet}
									{#snippet extraContent()}
										{#if s.ownerType === 'booking' && s.totalAmountDue > 0}
											<div class="border-t border-gray-100 px-3 py-2">
												<div class="mb-1 flex items-center justify-between">
													<span class="text-[10px] text-muted">€{s.totalAmountPaid.toFixed(0)} / €{s.totalAmountDue.toFixed(0)}</span>
													<span class="text-[10px] {paid === 100 ? 'text-green-600' : paid > 0 ? 'text-amber-600' : 'text-gray-400'}">
														{paid === 100 ? 'Pagado' : paid > 0 ? `${paid}%` : 'Pendiente'}
													</span>
												</div>
												<div class="h-1 overflow-hidden rounded-full bg-gray-100">
													<div class="h-full rounded-full {paid === 100 ? 'bg-green-500' : 'bg-amber-400'}" style="width:{paid}%"></div>
												</div>
											</div>
										{/if}
									{/snippet}
								</SessionListCard>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</div>
