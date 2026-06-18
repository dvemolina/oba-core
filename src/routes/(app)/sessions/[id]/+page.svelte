<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editing = $state(false);
	let editTime = $state(data.session.time?.slice(0, 5) ?? '');
	let editDuration = $state(data.session.durationMinutes ?? 60);
	let editLevel = $state(data.session.skillLevel ?? '');

	$effect(() => {
		if (!editing) {
			editTime = data.session.time?.slice(0, 5) ?? '';
			editDuration = data.session.durationMinutes ?? 60;
			editLevel = data.session.skillLevel ?? '';
		}
	});

	const color = $derived(getServiceColor(data.serviceColor ?? ''));

	function fmtTime(t: string | null) { return t?.slice(0, 5) ?? '—'; }

	function addMins(t: string, m: number) {
		const [h, min] = t.split(':').map(Number);
		const total = h * 60 + min + m;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}

	const timeRange = $derived(
		data.session.time && data.session.durationMinutes
			? `${fmtTime(data.session.time)} – ${addMins(fmtTime(data.session.time), data.session.durationMinutes)}`
			: fmtTime(data.session.time)
	);

	const activeEnrollments = $derived(data.enrollments.filter(e => e.status !== 'cancelled'));

	function ownerLabel() {
		if (data.session.ownerType === 'service') return 'Clase de grupo';
		if (data.session.ownerType === 'edition') return 'Campamento';
		return 'Clase privada';
	}

	const statusBadge = $derived(
		data.session.status === 'cancelled' ? { label: 'Cancelada', cls: 'bg-red-100 text-red-700' } :
		data.session.status === 'completed' ? { label: 'Completada', cls: 'bg-green-100 text-green-700' } :
		data.session.status === 'unscheduled' ? { label: 'Sin horario', cls: 'bg-amber-100 text-amber-700' } :
		{ label: 'Activa', cls: 'bg-blue-100 text-blue-700' }
	);
</script>

<div class="mx-auto max-w-2xl p-4 md:p-6">
	<!-- Breadcrumb -->
	<div class="mb-5 flex items-center gap-2 text-sm text-muted">
		<a href={data.backLink} class="hover:text-navy">← {data.backLabel}</a>
	</div>

	<!-- Session header card -->
	<div class="mb-5 rounded-xl border-l-4 {color.border} {color.bg} ring-1 ring-border p-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-muted mb-0.5">{ownerLabel()}</p>
				<p class="text-lg font-bold text-navy">{data.serviceName ?? '—'}</p>
				<p class="mt-1 text-sm text-gray-600">
					{new Date(data.session.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
				</p>
				<p class="text-sm font-medium text-gray-800 mt-0.5">{timeRange}</p>
				{#if data.session.durationMinutes}
					<p class="text-xs text-muted">{data.session.durationMinutes} min</p>
				{/if}
				{#if data.session.instructors.length}
					<p class="mt-1 text-xs text-muted">
						Monitor: {data.session.instructors.map(i => i.instructorName).filter(Boolean).join(', ')}
					</p>
				{/if}
				{#if data.session.notes}
					<p class="mt-1 text-xs italic text-muted">{data.session.notes}</p>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-2 shrink-0">
				<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.cls}">{statusBadge.label}</span>
				{#if data.session.ownerType === 'service'}
					<a href={data.backLink} class="text-xs text-indigo-600 hover:underline">Ver todas →</a>
				{:else if data.session.ownerType === 'edition'}
					<a href={data.backLink} class="text-xs text-indigo-600 hover:underline">Ver programa →</a>
				{:else}
					<a href={data.backLink} class="text-xs text-indigo-600 hover:underline">Ver reserva →</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action bar -->
	{#if data.session.status !== 'cancelled'}
		<div class="mb-5 flex gap-2 flex-wrap">
			<button type="button" onclick={() => editing = !editing}
				class="btn-primary btn-sm">{editing ? 'Cerrar edición' : 'Editar sesión'}</button>
			<form method="POST" action="?/cancelSession" use:enhance={withToast()}>
				<button type="submit" class="btn-ghost btn-sm text-amber-700">Cancelar sesión</button>
			</form>
			<form method="POST" action="?/deleteSession" use:enhance>
				<input type="hidden" name="backLink" value={data.backLink} />
				<button type="submit"
					onclick={(e) => { if (!confirm('¿Eliminar esta sesión permanentemente?')) e.preventDefault(); }}
					class="btn-ghost btn-sm text-red-600">Eliminar</button>
			</form>
		</div>
	{/if}

	<!-- Edit form -->
	{#if editing}
		<form method="POST" action="?/updateSession"
			use:enhance={withToast(() => { editing = false; })}
			class="mb-5 rounded-xl ring-1 ring-indigo-200 bg-indigo-50/40 p-4 space-y-3">
			<p class="text-sm font-semibold text-indigo-800">Editar sesión</p>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="label text-xs">Hora</label>
					<input name="time" type="time" bind:value={editTime} class="input text-sm w-full" />
				</div>
				<div>
					<label class="label text-xs">Duración (min)</label>
					<input name="durationMinutes" type="number" min="1" bind:value={editDuration} class="input text-sm w-full" />
				</div>
				<div class="col-span-2">
					<label class="label text-xs">Notas</label>
					<input name="notes" type="text" value={data.session.notes ?? ''} class="input text-sm w-full" />
				</div>
				{#if data.session.ownerType === 'booking'}
					<div class="col-span-2">
						<label class="label text-xs">Nivel</label>
						<div class="flex gap-1.5 mt-0.5">
							{#each [{ v: 'beginner', l: 'Principiante' }, { v: 'intermediate', l: 'Intermedio' }, { v: 'advanced', l: 'Avanzado' }] as lvl}
								<button type="button" onclick={() => editLevel = editLevel === lvl.v ? '' : lvl.v}
									class="flex-1 rounded border py-1 text-[10px] font-medium
										{editLevel === lvl.v ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-border text-muted hover:border-indigo-200'}">
									{lvl.l}
								</button>
							{/each}
						</div>
						<input type="hidden" name="skillLevel" value={editLevel} />
					</div>
				{/if}
				<div class="col-span-2">
					<label class="label text-xs mb-1 block">Monitor</label>
					<div class="space-y-1.5">
						{#each data.instructors as inst}
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" name="instructorId" value={inst.id}
									checked={data.session.instructors.some(i => i.instructorId === inst.id)}
									class="h-3.5 w-3.5 accent-indigo-600" />
								<span class="text-xs text-gray-700">{inst.name}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>
			<button type="submit" class="btn-primary btn-sm btn-block">Guardar cambios</button>
		</form>
	{/if}

	<!-- Enrollments (service / edition sessions) -->
	{#if data.session.ownerType !== 'booking'}
		<section class="mb-5 rounded-xl ring-1 ring-border bg-surface overflow-hidden">
			<div class="px-4 py-3 border-b border-border flex items-center justify-between">
				<p class="text-sm font-semibold text-navy">Reservas asignadas</p>
				<div class="flex items-center gap-3">
					<span class="text-xs text-muted">{activeEnrollments.length} reserva{activeEnrollments.length !== 1 ? 's' : ''}</span>
					{#if data.serviceId}
						<a
							href="/bookings/new?serviceId={data.serviceId}&date={data.session.date}"
							class="text-xs font-medium text-indigo-600 hover:underline"
						>+ Nueva reserva</a>
					{/if}
				</div>
			</div>
			{#if activeEnrollments.length === 0}
				<p class="px-4 py-4 text-sm text-muted">Sin reservas asignadas.</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each activeEnrollments as e}
						<li class="flex items-center justify-between gap-3 px-4 py-3">
							<div>
								<a href="/bookings/{e.bookingId}" class="text-sm font-medium text-navy hover:text-indigo-600 hover:underline">
									{e.firstName ?? ''} {e.lastName ?? ''}
								</a>
								<div class="flex items-center gap-2 mt-0.5">
									{#if parseFloat(e.amountPaid) >= parseFloat(e.amountDue) && parseFloat(e.amountDue) > 0}
										<span class="rounded-full px-1.5 py-px text-[10px] bg-green-100 text-green-700">Pagado</span>
									{:else if parseFloat(e.amountPaid) > 0}
										<span class="rounded-full px-1.5 py-px text-[10px] bg-yellow-100 text-yellow-700">Parcial</span>
									{:else}
										<span class="rounded-full px-1.5 py-px text-[10px] bg-gray-100 text-gray-600">Pendiente</span>
									{/if}
									<span class="text-xs text-muted">{parseFloat(e.amountPaid).toFixed(0)}/{parseFloat(e.amountDue).toFixed(0)} €</span>
								</div>
							</div>
							{#if data.session.ownerType === 'service'}
								<form method="POST" action="?/unassignFromSession" use:enhance={withToast()}>
									<input type="hidden" name="bookingId" value={e.bookingId} />
									<button type="submit" class="text-xs text-muted hover:text-red-600" title="Quitar de esta sesión">✕</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Bookings for this service/date that can be assigned -->
		{#if data.assignableBookings.length > 0}
			<section class="mb-5 rounded-xl ring-1 ring-border bg-surface overflow-hidden">
				<details>
					<summary class="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 select-none hover:bg-sand/50">
						<p class="text-sm font-semibold text-navy">Asignar reserva existente</p>
						<span class="text-xs text-muted">{data.assignableBookings.length} disponible{data.assignableBookings.length !== 1 ? 's' : ''}</span>
					</summary>
					<ul class="divide-y divide-border border-t border-border">
						{#each data.assignableBookings as u}
							<li class="flex items-center justify-between gap-3 px-4 py-3">
								<div>
									<a href="/bookings/{u.bookingId}" class="text-sm font-medium text-navy hover:underline">
										{u.firstName ?? ''} {u.lastName ?? ''}
									</a>
									{#if u.currentSessionId}
										<p class="text-[10px] text-amber-600 mt-0.5">Ya asignada a otra sesión</p>
									{:else}
										<p class="text-[10px] text-muted mt-0.5">Sin sesión</p>
									{/if}
								</div>
								<form method="POST" action="?/assignBooking" use:enhance={withToast()}>
									<input type="hidden" name="bookingId" value={u.bookingId} />
									<button type="submit" class="btn-sm rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700">
										{u.currentSessionId ? 'Reasignar' : 'Asignar'}
									</button>
								</form>
							</li>
						{/each}
					</ul>
				</details>
			</section>
		{/if}
	{:else if data.bookingClientName}
		<!-- Private booking client info -->
		<section class="mb-5 rounded-xl ring-1 ring-border bg-surface p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Cliente</p>
			<a href={data.backLink} class="text-sm font-medium text-navy hover:text-indigo-600 hover:underline">
				{data.bookingClientName}
			</a>
			<p class="text-xs text-muted mt-0.5">Ver detalles y pagos en <a href={data.backLink} class="text-indigo-600 hover:underline">la reserva →</a></p>
		</section>
	{/if}

	<!-- Participants -->
	<section class="rounded-xl ring-1 ring-border bg-surface overflow-hidden">
		<div class="px-4 py-3 border-b border-border flex items-center justify-between">
			<p class="text-sm font-semibold text-navy">Participantes</p>
			<span class="text-xs text-muted">{data.participants.length}</span>
		</div>
		{#if data.participants.length > 0}
			<ul class="divide-y divide-border">
				{#each data.participants as p}
					<li class="px-4 py-2.5">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<!-- Name with inline edit -->
								<form method="POST" action="?/renameParticipant" use:enhance={withToast()}
									class="group flex items-center gap-1.5">
									<input type="hidden" name="participantId" value={p.id} />
									<input
										name="name"
										value={p.name}
										class="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-gray-800
											hover:border-border focus:border-indigo-400 focus:bg-white focus:outline-none"
										onblur={(e) => e.currentTarget.form?.requestSubmit()}
									/>
								</form>
								<!-- Booking context -->
								{#if p.bookingId && p.clientFirstName}
									<a href="/bookings/{p.bookingId}"
										class="text-[10px] text-indigo-500 hover:underline mt-0.5 block">
										{p.clientFirstName} {p.clientLastName ?? ''} →
									</a>
								{:else if p.bookingParticipantId}
									<span class="text-[10px] text-muted">Reserva vinculada</span>
								{/if}
							</div>
							<form method="POST" action="?/removeParticipant" use:enhance={withToast()}>
								<input type="hidden" name="participantId" value={p.id} />
								<button type="submit" class="mt-1 text-xs text-muted hover:text-red-600">✕</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-4 py-3 text-sm text-muted">Sin participantes nombrados.</p>
		{/if}
		<div class="px-4 py-3 border-t border-border">
			<form method="POST" action="?/addParticipant" use:enhance={withToast()} class="flex gap-2">
				<input name="participantName" placeholder="Nombre del participante..." class="input text-sm flex-1" />
				<button type="submit" class="btn-ghost btn-sm">+ Añadir</button>
			</form>
		</div>
	</section>
</div>
