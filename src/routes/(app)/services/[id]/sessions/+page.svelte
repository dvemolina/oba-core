<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Track which session has its edit form open
	let editingId = $state<string | null>(null);

	const sessionsByDate = $derived(() => {
		const map: Record<string, typeof data.sessions> = {};
		for (const s of data.sessions) (map[s.date] ??= []).push(s);
		return map;
	});

	const sortedDates = $derived(Object.keys(sessionsByDate()).sort());

	const totalUnassigned = $derived(
		Object.values(data.unassignedByDate).reduce((acc, list) => acc + list.length, 0)
	);

	function fmtTime(t: string | null) {
		return t?.slice(0, 5) ?? '—';
	}

	function statusLabel(s: string) {
		if (s === 'cancelled') return 'Cancelada';
		if (s === 'completed') return 'Completada';
		return 'Activa';
	}

	function statusDot(s: string) {
		if (s === 'cancelled') return 'bg-red-400';
		if (s === 'completed') return 'bg-green-400';
		return 'bg-blue-400';
	}
</script>

<div class="p-4 md:p-6 max-w-3xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">
			← {data.service.name}
		</a>
		<h1 class="text-xl font-bold text-navy">Sesiones de grupo</h1>
	</div>

	{#if totalUnassigned > 0}
		<div class="mb-5 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
			<p class="text-sm font-medium text-amber-800">
				⚠ {totalUnassigned} inscripción{totalUnassigned !== 1 ? 'es' : ''} sin asignar a sesión
			</p>
		</div>
	{/if}

	<!-- Add session -->
	<details class="mb-6 group">
		<summary class="cursor-pointer text-sm font-medium text-indigo-600 select-none">
			+ Añadir sesión
		</summary>
		<form
			method="POST"
			action="?/addSession"
			use:enhance={withToast()}
			class="mt-3 rounded-lg bg-surface ring-1 ring-border p-4 grid grid-cols-2 gap-3"
		>
			<div class="col-span-2 sm:col-span-1">
				<label class="label text-xs">Fecha *</label>
				<input name="date" type="date" class="input text-sm w-full" required />
			</div>
			<div>
				<label class="label text-xs">Hora</label>
				<input name="time" type="time" class="input text-sm w-full" />
			</div>
			<div>
				<label class="label text-xs">Duración (min)</label>
				<input name="durationMinutes" type="number" min="1" class="input text-sm w-full" placeholder="90" />
			</div>
			<div class="col-span-2">
				<label class="label text-xs">Monitor</label>
				<select name="instructorId" class="input text-sm w-full">
					<option value="">Sin asignar</option>
					{#each data.instructors as inst}
						<option value={inst.id}>{inst.name}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2">
				<label class="label text-xs">Notas</label>
				<input name="notes" type="text" class="input text-sm w-full" />
			</div>
			<div class="col-span-2">
				<button type="submit" class="btn-primary btn-sm">Crear sesión</button>
			</div>
		</form>
	</details>

	<!-- Sessions by date -->
	{#if data.sessions.length === 0}
		<p class="py-12 text-center text-sm text-muted">Sin sesiones. Crea la primera arriba.</p>
	{:else}
		{#each sortedDates as date}
			{@const daySessions = sessionsByDate()[date]}
			{@const unassigned = data.unassignedByDate[date] ?? []}

			<section class="mb-8">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
					{new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
				</h2>

				<!-- Unassigned enrollments for this date -->
				{#if unassigned.length > 0}
					<div class="mb-3 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-sm">
						<p class="font-medium text-amber-800 mb-2">
							{unassigned.length} cliente{unassigned.length !== 1 ? 's' : ''} sin asignar
						</p>
						{#each unassigned as u}
							<div class="flex items-center gap-2 mb-1.5 flex-wrap">
								<span class="text-amber-900 font-medium">{u.firstName} {u.lastName}</span>
								<a href="/bookings/{u.bookingId}" class="text-xs text-indigo-600 hover:underline">ver reserva</a>
								<form method="POST" action="?/assignBookingToSession" use:enhance={withToast()} class="flex gap-1 flex-wrap">
									<input type="hidden" name="bookingId" value={u.bookingId} />
									{#each daySessions.filter(s => s.status !== 'cancelled') as s}
										<button
											name="sessionId"
											value={s.id}
											class="rounded px-2 py-0.5 bg-white ring-1 ring-amber-300 hover:bg-amber-100 text-xs text-amber-800"
										>
											Asignar a {fmtTime(s.time)}
										</button>
									{/each}
								</form>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Session cards -->
				<div class="space-y-3">
					{#each daySessions as s}
						{@const enrollments = data.enrollmentsBySession[s.id] ?? []}
						{@const activeEnrollments = enrollments.filter(e => e.status !== 'cancelled')}

						<div class="rounded-lg ring-1 {s.status === 'cancelled' ? 'ring-red-200 bg-red-50' : 'ring-border bg-surface'} overflow-hidden">
							<!-- Session header -->
							<div class="px-4 py-3 flex items-start justify-between gap-2">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="inline-block w-2 h-2 rounded-full {statusDot(s.status)} mt-0.5"></span>
									<span class="font-semibold text-sm text-navy">{fmtTime(s.time)}</span>
									{#if s.durationMinutes}
										<span class="text-xs text-muted">{s.durationMinutes} min</span>
									{/if}
									{#if s.instructors.length}
										<span class="text-xs text-muted">·</span>
										<span class="text-xs text-muted">{s.instructors.map(i => i.instructorName).join(', ')}</span>
									{/if}
									<span class="ml-1 rounded-full px-2 py-0.5 text-xs font-medium {s.status === 'cancelled' ? 'bg-red-100 text-red-700' : s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}">
										{statusLabel(s.status)}
									</span>
									<span class="text-xs text-muted">
										{activeEnrollments.length} reserva{activeEnrollments.length !== 1 ? 's' : ''}
										{#if s.participants.length > 0}
											· {s.participants.length} participante{s.participants.length !== 1 ? 's' : ''}
										{/if}
									</span>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-3 shrink-0">
									<a href="/sessions/{s.id}?from=/services/{data.service.id}/sessions/" class="text-xs text-indigo-500 hover:underline">Ver →</a>
									{#if s.status !== 'cancelled'}
										<button
											type="button"
											onclick={() => editingId = editingId === s.id ? null : s.id}
											class="text-xs text-indigo-600 hover:underline"
										>
											{editingId === s.id ? 'Cerrar' : 'Editar'}
										</button>
										<form method="POST" action="?/cancelSession" use:enhance={withToast()}>
											<input type="hidden" name="sessionId" value={s.id} />
											<button type="submit" class="text-xs text-amber-600 hover:underline">Cancelar</button>
										</form>
									{/if}
									<form method="POST" action="?/deleteSession" use:enhance={withToast()}>
										<input type="hidden" name="sessionId" value={s.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm('¿Eliminar esta sesión? Los alumnos asignados quedarán sin sesión.')) e.preventDefault(); }}
											class="text-xs text-red-600 hover:underline"
										>Eliminar</button>
									</form>
								</div>
							</div>

							<!-- Inline edit form -->
							{#if editingId === s.id}
								<form
									method="POST"
									action="?/updateSession"
									use:enhance={withToast(() => { editingId = null; })}
									class="px-4 pb-4 pt-1 border-t border-border grid grid-cols-2 gap-3 bg-gray-50"
								>
									<input type="hidden" name="sessionId" value={s.id} />
									<div>
										<label class="label text-xs">Hora</label>
										<input name="time" type="time" value={s.time ?? ''} class="input text-sm w-full" />
									</div>
									<div>
										<label class="label text-xs">Duración (min)</label>
										<input name="durationMinutes" type="number" min="1" value={s.durationMinutes ?? ''} class="input text-sm w-full" />
									</div>
									<div class="col-span-2">
										<label class="label text-xs">Monitor</label>
										<select name="instructorId" class="input text-sm w-full">
											<option value="">Sin asignar</option>
											{#each data.instructors as inst}
												<option value={inst.id} selected={s.instructors.some(i => i.instructorId === inst.id)}>
													{inst.name}
												</option>
											{/each}
										</select>
									</div>
									<div class="col-span-2">
										<label class="label text-xs">Notas</label>
										<input name="notes" type="text" value={s.notes ?? ''} class="input text-sm w-full" />
									</div>
									<div class="col-span-2 flex gap-2">
										<button type="submit" class="btn-primary btn-sm">Guardar</button>
										<button type="button" onclick={() => editingId = null} class="btn-ghost btn-sm">Cancelar</button>
									</div>
								</form>
							{/if}

							<!-- Enrolled clients -->
							{#if activeEnrollments.length > 0}
								<div class="border-t border-border px-4 py-3">
									<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Reservas</p>
									<ul class="space-y-1.5">
										{#each activeEnrollments as e}
											<li class="flex items-center justify-between gap-2 text-sm">
												<div class="flex items-center gap-2">
													<a href="/bookings/{e.bookingId}" class="font-medium text-navy hover:text-indigo-600 hover:underline">
														{e.firstName ?? ''} {e.lastName ?? ''}
													</a>
													{#if parseFloat(e.amountPaid) >= parseFloat(e.amountDue) && parseFloat(e.amountDue) > 0}
														<span class="rounded-full px-1.5 py-0.5 text-xs bg-green-100 text-green-700">Pagado</span>
													{:else if parseFloat(e.amountPaid) > 0}
														<span class="rounded-full px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700">Parcial</span>
													{:else}
														<span class="rounded-full px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600">Pendiente</span>
													{/if}
												</div>
												<div class="flex items-center gap-2">
													<span class="text-xs text-muted">{parseFloat(e.amountPaid).toFixed(0)}/{parseFloat(e.amountDue).toFixed(0)} €</span>
													<form method="POST" action="?/unassignFromSession" use:enhance={withToast()}>
														<input type="hidden" name="bookingId" value={e.bookingId} />
														<button type="submit" class="text-xs text-muted hover:text-red-600" title="Desasignar de esta sesión">✕</button>
													</form>
												</div>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Participants -->
							{#if s.participants.length > 0}
								<div class="border-t border-border px-4 py-3">
									<p class="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Participantes</p>
									<div class="flex flex-wrap gap-2">
										{#each s.participants as p}
											<span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{p.name}</span>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Notes -->
							{#if s.notes}
								<div class="border-t border-border px-4 py-2">
									<p class="text-xs text-muted italic">{s.notes}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
