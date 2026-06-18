<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sortedDates = $derived(Object.keys(data.byDate).sort());

	function ownerLabel(type: string) {
		if (type === 'service') return 'Grupo';
		if (type === 'edition') return 'Campamento';
		return 'Privada';
	}

	function ownerBadge(type: string) {
		if (type === 'service') return 'bg-blue-100 text-blue-700';
		if (type === 'edition') return 'bg-purple-100 text-purple-700';
		return 'bg-gray-100 text-gray-600';
	}

	function fmtDate(d: string) {
		return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
			weekday: 'long', day: 'numeric', month: 'long'
		});
	}

	function fmtTime(t: string | null) { return t?.slice(0, 5) ?? '—'; }

	function addMins(t: string, m: number) {
		const [h, min] = t.split(':').map(Number);
		const total = h * 60 + min + m;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}

	const totalCount = $derived(Object.values(data.byDate).reduce((acc, s) => acc + s.length, 0));
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Header -->
	<div class="border-b border-border bg-surface px-4 py-3 space-y-2 sm:px-6 sm:py-4">
		<div class="flex items-center justify-between gap-2">
			<h1 class="text-lg font-bold text-navy">Sesiones</h1>
			<p class="text-xs text-muted">{totalCount} sesión{totalCount !== 1 ? 'es' : ''}</p>
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
		</form>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-6 py-4">
		{#if sortedDates.length === 0}
			<div class="py-20 text-center text-sm text-muted">
				Sin sesiones en este período.
			</div>
		{:else}
			<div class="space-y-6 max-w-3xl mx-auto">
				{#each sortedDates as date}
					{@const daySessions = data.byDate[date]}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-widest text-muted capitalize">
							{fmtDate(date)}
						</h2>
						<div class="space-y-2">
							{#each daySessions as s}
								{@const color = getServiceColor(s.serviceColor ?? '')}
								{@const enrolledCount = s.bookingIds?.length ?? 0}
								<a
									href="/sessions/{s.id}"
									class="flex items-center gap-4 rounded-xl border-l-4 {color.border} {color.bg} px-4 py-3 ring-1 ring-border hover:brightness-95 transition-all"
								>
									<!-- Time -->
									<div class="w-16 shrink-0 text-center">
										<p class="text-sm font-bold text-navy">{fmtTime(s.time)}</p>
										{#if s.time && s.durationMinutes}
											<p class="text-[10px] text-muted">{addMins(fmtTime(s.time), s.durationMinutes)}</p>
										{/if}
									</div>

									<!-- Service + type -->
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											<p class="text-sm font-semibold text-navy truncate">{s.serviceName ?? '—'}</p>
											<span class="rounded-full px-1.5 py-px text-[10px] font-medium {ownerBadge(s.ownerType)}">
												{ownerLabel(s.ownerType)}
											</span>
										</div>
										<p class="text-xs text-muted mt-0.5">
											{#if s.durationMinutes}
												{s.durationMinutes} min
											{/if}
											{#if s.instructors.length}
												· {s.instructors.map(i => i.instructorName?.split(' ')[0]).filter(Boolean).join(', ')}
											{/if}
										</p>
									</div>

									<!-- Stats -->
									<div class="shrink-0 text-right">
										{#if s.ownerType === 'service'}
											<p class="text-sm font-bold text-navy">{enrolledCount}</p>
											<p class="text-[10px] text-muted">reservas</p>
										{:else if s.ownerType === 'booking' && s.firstClientName}
											<p class="text-xs font-medium text-navy">{s.firstClientName}</p>
											<p class="text-[10px] text-muted">privada</p>
										{:else if s.ownerType === 'edition'}
											<p class="text-sm font-bold text-navy">{enrolledCount}</p>
											<p class="text-[10px] text-muted">inscritos</p>
										{/if}
										{#if s.totalParticipants > 0}
											<p class="text-[10px] text-muted">{s.totalParticipants} part.</p>
										{/if}
									</div>

									<!-- Arrow -->
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
