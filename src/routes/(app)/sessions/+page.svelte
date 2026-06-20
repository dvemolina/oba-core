<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sortedDates = $derived(Object.keys(data.byDate).sort());
	const totalCount = $derived(Object.values(data.byDate).reduce((acc, s) => acc + s.length, 0));

	type Session = PageData['byDate'][string][number];

	function ownerLabel(s: Session) {
		if (s.ownerType === 'service') return 'Grupo';
		if (s.ownerType === 'edition') return 'Campamento';
		return 'Privada';
	}
	function ownerBadge(s: Session) {
		if (s.ownerType === 'service') return 'bg-blue-100 text-blue-700';
		if (s.ownerType === 'edition') return 'bg-purple-100 text-purple-700';
		return 'bg-gray-100 text-gray-600';
	}
	function fmtDate(d: string) {
		return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
			weekday: 'long', day: 'numeric', month: 'long'
		});
	}
	function fmtTime(t: string | null) { return t?.slice(0, 5) ?? '—'; }
	function endTime(t: string, m: number) {
		const [h, min] = t.split(':').map(Number);
		const total = h * 60 + min + m;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}
	function paidPct(s: Session) {
		if (!s.totalAmountDue || s.totalAmountDue === 0) return 0;
		return Math.min(100, Math.round((s.totalAmountPaid / s.totalAmountDue) * 100));
	}

	let editingId = $state<string | null>(null);
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
	<div class="flex-1 overflow-y-auto p-4 md:p-6">
		{#if sortedDates.length === 0}
			<div class="py-20 text-center text-sm text-muted">Sin sesiones en este período.</div>
		{:else}
			<div class="space-y-8">
				{#each sortedDates as date}
					{@const daySessions = data.byDate[date]}
					<section>
						<h2 class="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
							{fmtDate(date)}
						</h2>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{#each daySessions as s (s.id)}
								{@const color = getServiceColor(s.serviceColor ?? '')}
								{@const paid = paidPct(s)}
								{@const isCancelled = s.status === 'cancelled'}

								<div class="overflow-hidden rounded-xl border {isCancelled ? 'border-red-100 opacity-60' : 'border-gray-200'} bg-white shadow-sm">
									<!-- Card top: color stripe + time -->
									<div class="flex items-stretch">
										<!-- Color bar -->
										<div class="w-1 shrink-0 {color.bg.replace('bg-', 'bg-')} rounded-l-xl"
											style="background-color: {color.border.includes('border-') ? '' : ''}"></div>

										<!-- Time block -->
										<div class="flex w-20 shrink-0 flex-col items-center justify-center border-r border-gray-100 bg-gray-50/60 py-3">
											<p class="text-base font-bold leading-none text-green-600">{fmtTime(s.time)}</p>
											{#if s.time && s.effectiveDuration}
												<p class="mt-0.5 text-[10px] text-muted">{endTime(fmtTime(s.time), s.effectiveDuration)}</p>
												<p class="mt-1 text-[9px] text-gray-400">{s.effectiveDuration} min</p>
											{:else if !s.time}
												<p class="mt-1 text-[9px] rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">sin hora</p>
											{/if}
										</div>

										<!-- Main content -->
										<div class="min-w-0 flex-1 p-3">
											<!-- Service + badges -->
											<div class="mb-1 flex items-start justify-between gap-1.5">
												<p class="truncate text-sm font-semibold text-gray-900">{s.serviceName ?? '—'}</p>
												<div class="flex shrink-0 gap-1">
													<span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold {ownerBadge(s)}">{ownerLabel(s)}</span>
													{#if isCancelled}
														<span class="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">Cancelada</span>
													{/if}
												</div>
											</div>

											<!-- Client / enrolled -->
											{#if s.ownerType === 'booking' && s.firstClientName}
												<p class="mb-1 text-xs font-medium text-ocean">
													<a href="/bookings/{s.bookingId}" class="hover:underline">{s.firstClientName}</a>
												</p>
											{:else if (s.enrolledCount ?? 0) > 0}
												<p class="mb-1 text-[11px] text-muted">
													{s.enrolledCount} reserva{(s.enrolledCount ?? 0) !== 1 ? 's' : ''}
													{s.maxCapacity ? `· ${s.enrolledCount}/${s.maxCapacity}` : ''}
												</p>
											{/if}

											<!-- Instructor -->
											{#if s.instructors.length > 0}
												<p class="mb-1 text-[11px] text-muted">
													👤 {s.instructors.map(i => i.instructorName?.split(' ')[0]).filter(Boolean).join(', ')}
												</p>
											{/if}

											<!-- Participants -->
											{#if s.participantNames.length > 0}
												<div class="flex flex-wrap gap-1">
													{#each s.participantNames as name}
														<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700">{name}</span>
													{/each}
												</div>
											{/if}
										</div>
									</div>

									<!-- Payment bar (booking sessions only) -->
									{#if s.ownerType === 'booking' && s.totalAmountDue > 0}
										<div class="border-t border-gray-100 px-3 py-2">
											<div class="mb-1 flex items-center justify-between">
												<span class="text-[10px] text-muted">
													€{s.totalAmountPaid.toFixed(0)} / €{s.totalAmountDue.toFixed(0)}
												</span>
												<span class="text-[10px] {paid === 100 ? 'text-green-600' : paid > 0 ? 'text-amber-600' : 'text-gray-400'}">
													{paid === 100 ? 'Pagado' : paid > 0 ? `${paid}%` : 'Pendiente'}
												</span>
											</div>
											<div class="h-1 overflow-hidden rounded-full bg-gray-100">
												<div class="h-full rounded-full {paid === 100 ? 'bg-green-500' : 'bg-amber-400'} transition-all"
													style="width: {paid}%"></div>
											</div>
										</div>
									{/if}

									<!-- Notes snippet -->
									{#if s.notes}
										<div class="border-t border-gray-100 px-3 py-1.5">
											<p class="truncate text-[10px] italic text-gray-400">{s.notes}</p>
										</div>
									{/if}

									<!-- Inline edit form -->
									{#if editingId === s.id}
										<form method="POST" action="?/updateSession"
											use:enhance={withToast(() => { editingId = null; })}
											class="border-t border-gray-100 bg-gray-50 px-3 py-2.5 space-y-2">
											<input type="hidden" name="sessionId" value={s.id} />
											<div class="flex gap-2">
												<div class="flex-1">
													<label class="mb-0.5 block text-[10px] text-muted">Hora</label>
													<input name="sessionTime" type="time" value={s.time ?? ''} class="input w-full text-xs" />
												</div>
												<div class="flex-1">
													<label class="mb-0.5 block text-[10px] text-muted">Duración (min)</label>
													<input name="sessionDuration" type="number" min="15" step="15" value={s.effectiveDuration ?? ''} class="input w-full text-xs" />
												</div>
											</div>
											<div class="flex gap-2">
												<button type="submit" class="btn-primary btn-sm text-xs">Guardar</button>
												<button type="button" onclick={() => editingId = null} class="text-xs text-muted">Cancelar</button>
											</div>
										</form>
									{/if}

									<!-- Footer actions -->
									<div class="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-3 py-1.5">
										<div class="flex items-center gap-3">
											{#if !isCancelled}
												<button type="button"
													onclick={() => editingId = editingId === s.id ? null : s.id}
													class="text-[10px] text-gray-400 hover:text-gray-700">Editar</button>
												<form method="POST" action="?/cancelSession" use:enhance={withToast()}>
													<input type="hidden" name="sessionId" value={s.id} />
													<button type="submit"
														onclick={(e) => { if (!confirm('¿Cancelar sesión?')) e.preventDefault(); }}
														class="text-[10px] text-red-400 hover:text-red-600">Cancelar</button>
												</form>
											{/if}
										</div>
										<a href="/sessions/{s.id}" class="text-[10px] text-ocean hover:underline">Abrir →</a>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</div>
