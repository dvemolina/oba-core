<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	let { data }: { data: PageData } = $props();

	const sortedDates = $derived(Object.keys(data.byDate).sort());
	const totalCount = $derived(Object.values(data.byDate).reduce((acc, b) => acc + b.length, 0));

	const statusColors: Record<string, string> = {
		confirmed: 'bg-green-100 text-green-700',
		pending:   'bg-amber-100 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};
	const statusLabels: Record<string, string> = {
		confirmed: 'Confirmado',
		pending:   'Pendiente',
		cancelled: 'Cancelado'
	};

	function bookingTypeBadge(b: PageData['byDate'][string][number]) {
		if (b.serviceHasDateRange) return { label: 'Campamento', cls: 'bg-purple-100 text-purple-700' };
		if (b.serviceHasRoster)   return { label: 'Grupo',      cls: 'bg-blue-100 text-blue-700' };
		return { label: 'Privada', cls: 'bg-gray-100 text-gray-600' };
	}

	function fmtDate(d: string) {
		return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
			weekday: 'long', day: 'numeric', month: 'long'
		});
	}
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Header -->
	<div class="border-b border-border bg-surface px-4 py-3 space-y-2 sm:px-6 sm:py-4">
		<div class="flex items-center justify-between gap-2">
			<h1 class="text-lg font-bold text-navy">{m.booking_list_title()}</h1>
			<div class="flex items-center gap-2">
				<p class="text-xs text-muted">{totalCount} reserva{totalCount !== 1 ? 's' : ''}</p>
				<a href="/bookings/new" class="btn-primary btn-sm">{m.common_new()}</a>
			</div>
		</div>
		<form method="GET" class="flex flex-wrap items-center gap-2">
			<input type="date" name="from" value={data.from} class="input text-sm min-w-0 flex-1"
				onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			<span class="text-xs text-muted">→</span>
			<input type="date" name="to" value={data.to} class="input text-sm min-w-0 flex-1"
				onchange={(e) => e.currentTarget.form?.requestSubmit()} />
			{#if data.uniqueServices.length > 1}
				<select name="service" class="input text-sm w-full sm:w-auto"
					onchange={(e) => e.currentTarget.form?.requestSubmit()}>
					<option value="">Todos los servicios</option>
					{#each data.uniqueServices as svc}
						<option value={svc} selected={svc === data.serviceFilter}>{svc}</option>
					{/each}
				</select>
			{/if}
			{#if data.statusFilter !== 'all'}
				<input type="hidden" name="status" value={data.statusFilter} />
			{/if}
		</form>

		<!-- Status tabs -->
		<div class="flex gap-1.5 overflow-x-auto py-0.5">
			{#each [
				{ value: 'all',       label: m.booking_list_filter_all() },
				{ value: 'pending',   label: m.booking_list_filter_pending() },
				{ value: 'confirmed', label: m.booking_list_filter_confirmed() },
				{ value: 'cancelled', label: m.booking_list_filter_cancelled() }
			] as tab}
				<a
					href="?from={data.from}&to={data.to}{data.serviceFilter ? '&service=' + encodeURIComponent(data.serviceFilter) : ''}{tab.value !== 'all' ? '&status=' + tab.value : ''}"
					class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors
					       {data.statusFilter === tab.value || (tab.value === 'all' && data.statusFilter === 'all')
					         ? 'bg-ocean text-white'
					         : 'bg-surface text-muted ring-1 ring-border hover:text-gray-700'}"
				>{tab.label}</a>
			{/each}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-6 py-4">
		{#if sortedDates.length === 0}
			<div class="py-20 text-center text-sm text-muted">Sin reservas en este período.</div>
		{:else}
			<div class="space-y-6 max-w-3xl mx-auto">
				{#each sortedDates as date}
					{@const dayBookings = data.byDate[date]}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
							{fmtDate(date)}
						</h2>
						<div class="space-y-2">
							{#each dayBookings as b}
								{@const color = getServiceColor(b.serviceColor ?? '')}
								{@const badge = bookingTypeBadge(b)}
								<a
									href="/bookings/{b.id}"
									class="flex items-center gap-4 rounded-xl border-l-4 {color.border} {color.bg} px-4 py-3 ring-1 ring-border hover:brightness-95 transition-all"
								>
									<!-- Client -->
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											<p class="text-sm font-semibold text-navy truncate">
												{b.firstClientName ?? '—'}
												{#if (b.clientCount ?? 0) > 1}
													<span class="text-xs font-normal text-muted">+{(b.clientCount ?? 0) - 1}</span>
												{/if}
											</p>
											<span class="rounded-full px-1.5 py-px text-[10px] font-medium {badge.cls}">{badge.label}</span>
										</div>
										<p class="text-xs text-muted mt-0.5 truncate">
											{b.serviceName ?? '—'}
											{#if b.serviceEditionStartDate}
												· {b.serviceEditionStartDate} → {b.serviceEditionEndDate}
											{/if}
										</p>
									</div>

									<!-- Stats -->
									<div class="shrink-0 text-right">
										{#if b.serviceHasSessions && (b.sessionCount ?? 0) > 0}
											<p class="text-sm font-bold {(b.scheduledCount ?? 0) < (b.sessionCount ?? 0) ? 'text-amber-600' : 'text-navy'}">
												{b.scheduledCount ?? 0}/{b.sessionCount ?? 0}
											</p>
											<p class="text-[10px] text-muted">{m.booking_list_sessions()}</p>
										{/if}
									</div>

									<!-- Status -->
									<div class="shrink-0">
										<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold {statusColors[b.status] ?? ''}">
											{statusLabels[b.status] ?? b.status}
										</span>
									</div>

									<span class="shrink-0 text-xs text-muted">→</span>
								</a>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</div>
