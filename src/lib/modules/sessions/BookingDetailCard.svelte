<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import { fmtTimeRange, checkAllInstructorConflicts } from '$lib/features/calendar/utils';
	import type { InstructorConflict } from '$lib/features/calendar/utils';
	import type { ServiceModules } from '$lib/features/services/modules';
	import type { BookingParticipant } from '$lib/features/bookings/types';
	import type { Session } from '$lib/features/sessions/types';
	import type { SessionForDay } from '$lib/features/sessions/types';
	import { getLocale } from '$lib/paraglide/runtime';

	// ── Local interfaces ──────────────────────────────────────────────────────

	interface Instructor {
		id: string;
		name: string;
	}

	let {
		booking,
		modules,
		sessions,
		allDateSessions,
		instructors,
		participantsByEnrollment
	}: {
		booking: { id: string; date: string; dateEnd?: string | null; status: string };
		modules: ServiceModules;
		sessions: Session[];
		allDateSessions: SessionForDay[];
		instructors: Instructor[];
		participantsByEnrollment: Record<string, BookingParticipant[]>;
	} = $props();

	// ── Derived state ─────────────────────────────────────────────────────────

	// Flat list of all named participants across all enrollments
	const allParticipants = $derived(
		Object.values(participantsByEnrollment).flat()
	);

	// Sessions grouped by date
	const sessionsByDate = $derived(() => {
		const map: Record<string, Session[]> = {};
		for (const s of sessions) (map[s.date] ??= []).push(s);
		for (const d in map) map[d].sort((a, b) => a.sortOrder - b.sortOrder || (a.time ?? '').localeCompare(b.time ?? ''));
		return map;
	});

	const scheduledSessions = $derived(sessions.filter(s => s.status === 'scheduled'));
	const unscheduledSessions = $derived(sessions.filter(s => s.status === 'unscheduled'));
	const activeSessions = $derived(sessions.filter(s => s.status !== 'cancelled'));

	const hasDateRange = $derived(!!(booking.dateEnd));

	// ── Service duration (from modules config if available) ───────────────────
	const serviceDuration = $derived((modules.sessions as { durationMinutes?: number } | undefined)?.durationMinutes ?? 60);

	function sessionDur(s: { durationMinutes: number | null }): number {
		return s.durationMinutes ?? serviceDuration;
	}

	// ── Local state ───────────────────────────────────────────────────────────

	let editingSessionId = $state<string | null>(null);
	let editFormTime = $state('');
	let editFormDuration = $state(serviceDuration);
	let editSessionLevel = $state('');

	$effect(() => {
		if (editingSessionId) {
			const s = sessions.find(s => s.id === editingSessionId);
			editFormTime = s?.time?.slice(0, 5) ?? '';
			editFormDuration = sessionDur(s ?? { durationMinutes: null });
			editSessionLevel = s?.skillLevel ?? '';
		}
	});

	const editConflicts = $derived(
		editingSessionId && editFormTime && allDateSessions
			? checkAllInstructorConflicts(instructors.map(i => i.id), booking.date,
				editFormTime, editFormDuration, allDateSessions, editingSessionId)
			: {} as Record<string, InstructorConflict[]>
	);

	let showAddSession = $state(false);
	let showBulkGenerate = $state(false);
	let bulkSessionsPerDay = $state(2);

	const DEFAULT_TIMES_MAP: Record<number, string[]> = {
		1: ['09:00'], 2: ['09:00', '14:00'], 3: ['09:00', '12:00', '16:00'],
		4: ['09:00', '11:00', '14:00', '16:30']
	};
	let bulkTimes = $state(['09:00', '14:00']);

	$effect(() => { bulkTimes = DEFAULT_TIMES_MAP[bulkSessionsPerDay] ?? Array.from({ length: bulkSessionsPerDay }, () => ''); });

	let addFormTime = $state('');
	let addFormDuration = $state(serviceDuration);

	const addConflicts = $derived(
		showAddSession && addFormTime && allDateSessions
			? checkAllInstructorConflicts(instructors.map(i => i.id), booking.date,
				addFormTime, addFormDuration, allDateSessions)
			: {} as Record<string, InstructorConflict[]>
	);

	// ── Helpers ───────────────────────────────────────────────────────────────

	function fmtDate(d: string) {
		return new Date(d + 'T00:00:00').toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
	}
</script>

<div class="rounded-(--radius-card) bg-surface ring-1 ring-indigo-100 overflow-hidden">
	<!-- ── Header ─────────────────────────────────────────────────────────────── -->
	<div class="flex items-center justify-between px-4 pt-4 pb-3">
		<div class="border-l-2 border-indigo-400 pl-2">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">
				⏱ Sesiones
				<span class="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
					{activeSessions.length} sesiones
				</span>
			</p>
			{#if unscheduledSessions.length > 0}
				<p class="mt-0.5 text-[11px] text-amber-600">
					{unscheduledSessions.length} sin horario asignado
				</p>
			{/if}
		</div>

		{#if booking.status !== 'cancelled'}
			<div class="flex items-center gap-3">
				{#if hasDateRange}
					<button
						type="button"
						onclick={() => { showBulkGenerate = !showBulkGenerate; showAddSession = false; }}
						class="text-xs font-medium text-muted hover:text-slate-700"
					>
						{showBulkGenerate ? 'Cancelar' : 'Generar'}
					</button>
				{/if}
				<button
					type="button"
					onclick={() => { showAddSession = !showAddSession; showBulkGenerate = false; }}
					class="text-xs font-medium text-indigo-600 hover:underline"
				>
					{showAddSession ? 'Cancelar' : '+ Añadir'}
				</button>
			</div>
		{/if}
	</div>

	<!-- ── Unscheduled banner ─────────────────────────────────────────────────── -->
	{#if unscheduledSessions.length > 0}
		<div class="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
			<p class="text-xs font-medium text-amber-700">
				⚠ {unscheduledSessions.length} {unscheduledSessions.length === 1 ? 'sesión pendiente de horario' : 'sesiones pendientes de horario'}
			</p>
		</div>
	{/if}

	<!-- ── Bulk generate form ─────────────────────────────────────────────────── -->
	{#if showBulkGenerate}
		<form
			method="post"
			action="?/bulkGenerateSessions"
			use:enhance={withToast(() => { showBulkGenerate = false; })}
			class="mx-4 mb-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3"
		>
			<p class="text-xs font-semibold text-amber-800">
				Generar sesiones: {booking.date} → {booking.dateEnd ?? ''}
			</p>
			<div>
				<label class="text-xs text-muted">Sesiones por día</label>
				<input
					name="sessionsPerDay"
					type="number"
					min="1"
					max="6"
					bind:value={bulkSessionsPerDay}
					class="mt-0.5 input text-xs w-24"
				/>
			</div>
			<div class="space-y-1">
				<label class="text-xs text-muted">Horarios</label>
				{#each bulkTimes as _, i}
					<input name="sessionTime_{i}" type="time" bind:value={bulkTimes[i]} class="mt-0.5 input text-xs" />
				{/each}
			</div>
			<label class="flex cursor-pointer items-center gap-2">
				<input type="checkbox" name="weekdaysOnly" class="h-3.5 w-3.5 accent-indigo-600" />
				<span class="text-xs text-gray-700">Solo días laborables</span>
			</label>
			{#if sessions.length > 0}
				<label class="flex cursor-pointer items-center gap-2">
					<input type="checkbox" name="clearExisting" class="h-3.5 w-3.5 accent-red-500" />
					<span class="text-xs text-red-600">Eliminar sesiones existentes</span>
				</label>
			{/if}
			<button type="submit" class="btn-primary btn-sm btn-block">Generar sesiones</button>
		</form>
	{/if}

	<!-- ── Add session form ───────────────────────────────────────────────────── -->
	{#if showAddSession}
		<form
			method="post"
			action="?/addSession"
			use:enhance={withToast(() => { showAddSession = false; })}
			class="mx-4 mb-3 space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3"
		>
			<p class="text-xs font-semibold text-indigo-700">Nueva sesión</p>
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label class="text-xs text-muted">Fecha</label>
					<input name="sessionDate" type="date" required value={booking.date} class="mt-0.5 input text-xs" />
				</div>
				<div>
					<label class="text-xs text-muted">Hora</label>
					<input name="sessionTime" type="time" bind:value={addFormTime} class="mt-0.5 input text-xs" />
				</div>
				<div>
					<label class="text-xs text-muted">Duración (min)</label>
					<input name="sessionDuration" type="number" min="15" step="15" bind:value={addFormDuration} class="mt-0.5 input text-xs" />
				</div>
			</div>
			<div>
				<label class="text-xs text-muted">Notas</label>
				<input name="sessionNotes" placeholder="Observaciones..." class="mt-0.5 input text-xs" />
			</div>
			{#if instructors.length > 0}
				<div>
					<label class="text-xs text-muted mb-1 block">Monitor/a</label>
					<div class="space-y-1.5">
						{#each instructors as instructor}
							{@const conflicts = addConflicts[instructor.id] ?? []}
							<label class="flex items-start gap-2 cursor-pointer">
								<input
									type="checkbox"
									name="sessionInstructorId"
									value={instructor.id}
									class="mt-0.5 h-3.5 w-3.5 accent-indigo-600 shrink-0"
								/>
								<div class="min-w-0">
									<span class="text-xs text-gray-700">{instructor.name}</span>
									{#if conflicts.length > 0}
										<p class="text-[10px] text-amber-600 font-medium">
											⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'sesión'}
										</p>
									{/if}
								</div>
							</label>
						{/each}
					</div>
				</div>
			{/if}
			<button type="submit" class="btn-primary btn-sm btn-block">Guardar sesión</button>
		</form>
	{/if}

	<!-- ── Sessions timeline ──────────────────────────────────────────────────── -->
	{#if sessions.length === 0}
		<p class="px-4 pb-4 text-sm text-muted">
			{hasDateRange ? 'Aún no hay sesiones. Usa Generar o + Añadir.' : 'Aún no hay sesiones. Usa + Añadir.'}
		</p>
	{:else}
		<div class="divide-y divide-indigo-100/60">
			{#each Object.entries(sessionsByDate()) as [date, daySessions]}
				<div class="px-4 py-3">
					<p class="mb-2 text-xs font-semibold text-indigo-700">{fmtDate(date)}</p>
					<div class="space-y-2">
						{#each daySessions as session (session.id)}
							<div class="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
								<!-- Session summary row -->
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-800">
											{#if session.time}
												{fmtTimeRange(session.time, sessionDur(session))}
												<span class="ml-1 text-xs font-normal text-muted">· {sessionDur(session)} min</span>
											{:else}
												<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">Sin horario</span>
											{/if}
											{#if session.notes}
												<span class="ml-1 text-xs font-normal text-muted">· {session.notes}</span>
											{/if}
										</p>
										<p class="text-xs text-muted">
											{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ') || '—'}
										</p>
									</div>
									<div class="flex shrink-0 items-center gap-1.5">
										<span class="text-[10px] text-muted capitalize">{session.status}</span>
										{#if session.skillLevel}
											<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
												{session.skillLevel === 'beginner' ? 'Principiante' : session.skillLevel === 'intermediate' ? 'Intermedio' : 'Avanzado'}
											</span>
										{/if}
										{#if booking.status !== 'cancelled'}
											<button
												type="button"
												onclick={() => editingSessionId = editingSessionId === session.id ? null : session.id}
												class="btn-ghost btn-sm p-1 text-xs"
											>Editar</button>
											<form method="post" action="?/cancelSession" use:enhance={withToast()}>
												<input type="hidden" name="sessionId" value={session.id} />
												<button
													type="submit"
													onclick={(e) => { if (!confirm('¿Cancelar esta sesión?')) e.preventDefault(); }}
													class="btn-destructive btn-sm p-1 text-xs"
												>✕</button>
											</form>
										{/if}
									</div>
								</div>

								<!-- Attendance display -->
								<div class="mt-2 border-t border-indigo-100/60 pt-2">
									<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Participantes</p>
									{#if allParticipants.length > 0}
										<!-- Checklist: tick booking-level participants in/out of this session -->
										<div class="space-y-1">
											{#each allParticipants as bp (bp.id)}
												{@const inSession = session.participants.find(sp => sp.name === bp.name)}
												{#if inSession}
													<div class="flex items-center justify-between rounded-md bg-indigo-50 px-2 py-1">
														<div class="flex items-center gap-2">
															<span class="h-3.5 w-3.5 rounded-full bg-indigo-200 flex items-center justify-center text-[9px] text-indigo-700">✓</span>
															<span class="text-xs font-medium text-gray-800">{bp.name}</span>
														</div>
														<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
															<input type="hidden" name="participantId" value={inSession.id} />
															<button type="submit" class="text-[10px] text-muted hover:text-red-500">Quitar</button>
														</form>
													</div>
												{:else}
													<form
														method="post"
														action="?/addParticipant"
														use:enhance={withToast()}
														class="flex items-center justify-between rounded-md px-2 py-1 hover:bg-indigo-50/60"
													>
														<input type="hidden" name="sessionId" value={session.id} />
														<input type="hidden" name="participantName" value={bp.name} />
														<div class="flex items-center gap-2">
															<span class="h-3.5 w-3.5 rounded-full border border-indigo-200 bg-white"></span>
															<span class="text-xs text-muted">{bp.name}</span>
														</div>
														<button type="submit" class="text-[10px] text-indigo-600 hover:underline">Añadir</button>
													</form>
												{/if}
											{/each}
										</div>
									{:else if session.participants.length > 0}
										<!-- No booking-level participants — show session participants directly -->
										<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
											{#each session.participants as p (p.id)}
												<div class="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 ring-1 ring-indigo-100">
													<span class="text-xs text-gray-700">{p.name}</span>
													<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
														<input type="hidden" name="participantId" value={p.id} />
														<button type="submit" class="ml-0.5 leading-none text-muted hover:text-red-500">×</button>
													</form>
												</div>
											{/each}
										</div>
									{:else}
										<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
											<span class="italic">Sin participantes nombrados</span>
										</div>
									{/if}

									<!-- Free-text add for sessions without booking-level participants -->
									{#if allParticipants.length === 0}
										<form method="post" action="?/addParticipant" use:enhance={withToast()} class="mt-1.5 flex gap-2">
											<input type="hidden" name="sessionId" value={session.id} />
											<input name="participantName" placeholder="Nombre del participante..." class="input input-sm flex-1 text-xs" />
											<button type="submit" class="btn-ghost btn-sm text-xs">Añadir</button>
										</form>
									{/if}
								</div>

								<!-- Inline edit form -->
								{#if editingSessionId === session.id}
									<form
										method="post"
										action="?/updateSession"
										use:enhance={withToast(() => { editingSessionId = null; })}
										class="mt-3 space-y-2 border-t border-indigo-100/60 pt-3"
									>
										<input type="hidden" name="sessionId" value={session.id} />
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label class="text-xs text-muted">Hora</label>
												<input name="sessionTime" type="time" bind:value={editFormTime} class="mt-0.5 input text-xs" />
											</div>
											<div>
												<label class="text-xs text-muted">Duración (min)</label>
												<input name="sessionDuration" type="number" min="15" step="15" bind:value={editFormDuration} class="mt-0.5 input text-xs" />
											</div>
											<div class="col-span-2">
												<label class="text-xs text-muted">Notas</label>
												<input name="sessionNotes" value={session.notes ?? ''} class="mt-0.5 input text-xs" />
											</div>
											<div class="col-span-2">
												<label class="text-xs text-muted">Nivel</label>
												<div class="mt-0.5 flex gap-1.5">
													{#each [
														{ value: 'beginner', label: 'Principiante' },
														{ value: 'intermediate', label: 'Intermedio' },
														{ value: 'advanced', label: 'Avanzado' }
													] as lvl}
														<button
															type="button"
															onclick={() => { editSessionLevel = editSessionLevel === lvl.value ? '' : lvl.value; }}
															class="flex-1 rounded border py-1 text-[10px] font-medium
																{editSessionLevel === lvl.value
																? 'border-indigo-400 bg-indigo-100 text-indigo-700'
																: 'border-border text-muted hover:border-indigo-200'}"
														>
															{lvl.label}
														</button>
													{/each}
												</div>
												<input type="hidden" name="sessionLevel" value={editSessionLevel} />
											</div>
										</div>
										{#if instructors.length > 0}
											<div class="space-y-1.5">
												{#each instructors as instructor}
													{@const conflicts = editConflicts[instructor.id] ?? []}
													<label class="flex items-start gap-2 cursor-pointer">
														<input
															type="checkbox"
															name="sessionInstructorId"
															value={instructor.id}
															checked={session.instructors.some(si => si.instructorId === instructor.id)}
															class="mt-0.5 h-3.5 w-3.5 accent-indigo-600 shrink-0"
														/>
														<div class="min-w-0">
															<span class="text-xs text-gray-700">{instructor.name}</span>
															{#if conflicts.length > 0}
																<p class="text-[10px] text-amber-600 font-medium">
																	⚠ {conflicts[0].startTime}–{conflicts[0].endTime} {conflicts[0].serviceName ?? 'sesión'}
																</p>
															{/if}
														</div>
													</label>
												{/each}
											</div>
										{/if}
										<button type="submit" class="btn-primary btn-sm btn-block">Guardar cambios</button>
									</form>
								{/if}
							</div>
						{/each}

						<!-- Quick add on this day -->
						<form method="post" action="?/addSession" use:enhance={withToast()} class="flex items-center gap-2">
							<input type="hidden" name="sessionDate" value={date} />
							<input name="sessionTime" type="time" class="input text-xs flex-1" />
							<button type="submit" class="btn-secondary btn-sm whitespace-nowrap">+ Sesión</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
