<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const sessionsByDate = $derived(() => {
		const map: Record<string, typeof data.sessions> = {};
		for (const s of data.sessions) (map[s.date] ??= []).push(s);
		return map;
	});

	const sortedDates = $derived(Object.keys(sessionsByDate()).sort());
	const totalUnassigned = $derived(
		Object.values(data.unassignedByDate).reduce((acc, list) => acc + list.length, 0)
	);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">
			← {data.service.name}
		</a>
		<h1 class="text-xl font-bold text-navy">Sesiones de grupo</h1>
	</div>

	{#if totalUnassigned > 0}
		<div class="mb-4 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
			<p class="text-sm text-amber-800">
				⚠ {totalUnassigned} inscripción{totalUnassigned > 1 ? 'es' : ''} sin asignar a sesión
			</p>
		</div>
	{/if}

	<!-- Add session form -->
	<details class="mb-6">
		<summary class="cursor-pointer text-sm font-medium text-indigo-600">+ Añadir sesión</summary>
		<form
			method="POST"
			action="?/addSession"
			use:enhance={withToast()}
			class="mt-3 rounded-lg bg-surface ring-1 ring-border p-4 grid grid-cols-2 gap-3"
		>
			<div class="col-span-2 sm:col-span-1">
				<label class="text-xs text-muted block mb-1">Fecha</label>
				<input name="date" type="date" class="input text-xs w-full" required />
			</div>
			<div>
				<label class="text-xs text-muted block mb-1">Hora</label>
				<input name="time" type="time" class="input text-xs w-full" />
			</div>
			<div>
				<label class="text-xs text-muted block mb-1">Duración (min)</label>
				<input name="durationMinutes" type="number" class="input text-xs w-full" placeholder="90" />
			</div>
			<div class="col-span-2">
				<label class="text-xs text-muted block mb-1">Monitor</label>
				<select name="instructorId" class="input text-xs w-full">
					<option value="">Sin asignar</option>
					{#each data.instructors as i}
						<option value={i.id}>{i.name}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2">
				<button type="submit" class="btn-primary btn-sm">Crear sesión</button>
			</div>
		</form>
	</details>

	{#if data.sessions.length === 0}
		<p class="py-8 text-center text-sm text-muted">Sin sesiones. Crea la primera arriba.</p>
	{:else}
		{#each sortedDates as date}
			{@const daySessions = sessionsByDate()[date]}
			{@const unassigned = data.unassignedByDate[date] ?? []}
			<div class="mb-6">
				<h2 class="mb-2 text-sm font-semibold text-gray-600">{date}</h2>

				{#if unassigned.length > 0}
					<div class="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
						{unassigned.length} cliente{unassigned.length > 1 ? 's' : ''} sin asignar:
						{#each unassigned as u}
							<div class="mt-1 flex items-center gap-2">
								<span>{u.firstName} {u.lastName}</span>
								<form method="POST" action="?/assignBookingToSession" use:enhance={withToast()} class="flex gap-1 flex-wrap">
									<input type="hidden" name="bookingId" value={u.bookingId} />
									{#each daySessions.filter(s => s.status !== 'cancelled') as s}
										<button name="sessionId" value={s.id} class="rounded px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-xs">
											Asignar a {s.time?.slice(0, 5) ?? 'sin hora'}
										</button>
									{/each}
								</form>
							</div>
						{/each}
					</div>
				{/if}

				<div class="divide-y divide-border rounded-lg ring-1 ring-border overflow-hidden">
					{#each daySessions as s}
						{@const statusClass = s.status === 'cancelled' ? 'bg-red-50' : 'bg-surface'}
						<div class="px-4 py-3 {statusClass}">
							<div class="flex items-center justify-between gap-2">
								<div>
									<span class="font-medium text-sm">{s.time?.slice(0, 5) ?? '—'}</span>
									{#if s.durationMinutes}
										<span class="text-xs text-muted ml-1">· {s.durationMinutes} min</span>
									{/if}
									{#if s.instructors.length}
										<span class="text-xs text-muted ml-1">· {s.instructors.map(i => i.instructorName).join(', ')}</span>
									{/if}
									{#if s.participants.length > 0}
										<span class="text-xs text-muted ml-2">({s.participants.length} part.)</span>
									{/if}
								</div>
								<div class="flex gap-2 items-center">
									<span class="text-xs capitalize text-muted">{s.status}</span>
									{#if s.status !== 'cancelled'}
										<form method="POST" action="?/cancelSession" use:enhance={withToast()}>
											<input type="hidden" name="sessionId" value={s.id} />
											<button type="submit" class="text-xs text-amber-600 hover:underline">Cancelar</button>
										</form>
									{/if}
									<form method="POST" action="?/deleteSession" use:enhance={withToast()}>
										<input type="hidden" name="sessionId" value={s.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm('¿Eliminar esta sesión?')) e.preventDefault(); }}
											class="text-xs text-red-600 hover:underline"
										>Eliminar</button>
									</form>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
