<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	let { data }: { data: PageData } = $props();

	let activeEditionId = $state(data.focusEditionId ?? data.editions[0]?.id ?? '');
	const activeEdition = $derived(data.editions.find(e => e.id === activeEditionId));
	const activeBookings = $derived(data.bookingsByEdition[activeEditionId] ?? []);
	// Use overlap-based participantCount sum (same source as calendar chips)
	const totalEnrolled = $derived(activeEdition?.enrolledCount ?? 0);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services/{data.service.id}" class="text-sm text-muted hover:text-navy">← {data.service.name}</a>
		<h1 class="text-xl font-bold text-navy">{m.camp_roster_title()}</h1>
	</div>

	{#if data.editions.length === 0}
		<div class="rounded-lg bg-sand p-6 text-center">
			<p class="text-sm text-muted">{m.camp_roster_no_runs()}</p>
			<a href="/services/{data.service.id}" class="mt-2 block text-sm text-ocean hover:underline">{m.camp_roster_add_run()}</a>
		</div>
	{:else}
		<!-- Edition tabs -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each data.editions as edition}
				<button
					onclick={() => activeEditionId = edition.id}
					class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {activeEditionId === edition.id ? 'bg-ocean text-white' : 'bg-surface ring-1 ring-border hover:ring-ocean/50'}"
				>
					{edition.startDate} → {edition.endDate}
					{#if edition.maxCapacity}
						<span class="ml-1 text-xs opacity-75">
							{edition.enrolledCount}/{edition.maxCapacity}
						</span>
					{/if}
				</button>
			{/each}
			<a href="/services/{data.service.id}" class="rounded-full px-3 py-1.5 text-sm text-muted ring-1 ring-border hover:ring-ocean/50">
				{m.camp_roster_add_run_short()}
			</a>
		</div>

		{#if activeEdition}
			<!-- Edition summary -->
			<div class="mb-4 rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-semibold text-gray-800">{activeEdition.startDate} → {activeEdition.endDate}</p>
						{#if activeEdition.maxCapacity}
							{@const slotsLeft = activeEdition.maxCapacity - totalEnrolled}
							<p class="text-xs {slotsLeft <= 0 ? 'text-red-600 font-medium' : slotsLeft <= 3 ? 'text-amber-600' : 'text-muted'}">
								{totalEnrolled} / {activeEdition.maxCapacity} {m.camp_roster_spots_filled()}
								{#if slotsLeft <= 0}
									· Aforo completo
								{:else if slotsLeft <= 3}
									· {slotsLeft} {slotsLeft === 1 ? 'plaza libre' : 'plazas libres'}
								{/if}
							</p>
						{:else}
							<p class="text-xs text-muted">{totalEnrolled} {m.camp_roster_enrolled()}</p>
						{/if}
						{#if activeEdition.notes}
							<p class="mt-0.5 text-xs text-muted">{activeEdition.notes}</p>
						{/if}
					</div>
					<a
						href="/bookings/new?serviceId={data.service.id}&editionId={activeEditionId}"
						class="btn-primary btn-sm"
					>
						{m.camp_roster_book_client()}
					</a>
				</div>
			</div>

			<!-- Roster -->
			{#if activeBookings.length === 0}
				<p class="py-8 text-center text-sm text-muted">{m.camp_roster_no_bookings()}</p>
			{:else}
				<div class="divide-y divide-border rounded-(--radius-card) ring-1 ring-border overflow-hidden">
					<!-- Header — fixed columns must match data row exactly -->
					<div class="grid grid-cols-[1fr_5rem_9rem_4.5rem] bg-sand px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
						<span>Cliente</span>
						<span class="text-right">Participantes</span>
						<span class="text-center">Estado</span>
						<span></span>
					</div>
					{#each activeBookings as booking}
						{@const statusClass = booking.status === 'confirmed'
							? 'bg-green-100 text-green-700'
							: booking.status === 'cancelled'
							? 'bg-red-100 text-red-700'
							: 'bg-sand text-muted'}
						<div class="grid grid-cols-[1fr_5rem_9rem_4.5rem] items-center bg-surface px-4 py-3 hover:bg-sand/50 transition-colors">
							<div class="min-w-0">
								<p class="font-medium text-gray-800 truncate">{booking.firstClientName ?? 'Desconocido'}</p>
								{#if booking.clientCount > 1}
									<p class="text-xs text-muted">+{booking.clientCount - 1} cliente{booking.clientCount > 2 ? 's' : ''} más</p>
								{/if}
							</div>
							<span class="tabular-nums text-sm text-right font-medium text-navy pr-2">
								{booking.participantCount ?? booking.clientCount}
							</span>
							<span class="flex justify-center">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusClass}">
									{booking.status === 'confirmed' ? 'Confirmado' : booking.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
								</span>
							</span>
							<a
								href="/bookings/{booking.id}"
								class="rounded-lg bg-ocean/10 px-2.5 py-1 text-xs font-semibold text-ocean hover:bg-ocean/20 transition-colors text-center"
							>
								Ver →
							</a>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Sessions section for this edition -->
			{@const editionSessions = data.sessionsByEdition[activeEditionId] ?? []}
			<div class="mt-6">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gray-700">Programa de sesiones</h2>
					<details class="relative">
						<summary class="cursor-pointer text-xs font-medium text-indigo-600">+ Añadir sesión</summary>
						<form
							method="POST"
							action="?/addEditionSession"
							use:enhance={withToast()}
							class="absolute right-0 z-10 mt-1 w-64 grid grid-cols-2 gap-2 rounded-lg bg-white ring-1 ring-border p-3 shadow-lg"
						>
							<input type="hidden" name="editionId" value={activeEditionId} />
							<div>
								<label class="text-xs text-muted block mb-1">Fecha</label>
								<input name="date" type="date" class="input text-xs w-full" required
									min={activeEdition?.startDate} max={activeEdition?.endDate} />
							</div>
							<div>
								<label class="text-xs text-muted block mb-1">Hora</label>
								<input name="time" type="time" class="input text-xs w-full" />
							</div>
							<div>
								<label class="text-xs text-muted block mb-1">Duración (min)</label>
								<input name="durationMinutes" type="number" class="input text-xs w-full" placeholder="90" />
							</div>
							<div>
								<label class="text-xs text-muted block mb-1">Monitor</label>
								<select name="instructorId" class="input text-xs w-full">
									<option value="">—</option>
									{#each data.instructors as i}
										<option value={i.id}>{i.name}</option>
									{/each}
								</select>
							</div>
							<div class="col-span-2">
								<button type="submit" class="btn-primary btn-sm w-full">Crear</button>
							</div>
						</form>
					</details>
				</div>

				{#if editionSessions.length === 0}
					<p class="text-center py-4 text-sm text-muted">Sin sesiones programadas</p>
				{:else}
					<div class="divide-y divide-border rounded-lg ring-1 ring-border overflow-hidden">
						{#each editionSessions as s}
							<div class="px-4 py-2 flex items-center gap-3 {s.status === 'cancelled' ? 'opacity-50' : ''}">
								<span class="text-xs w-24 shrink-0">{s.date}</span>
								<span class="text-sm font-medium">{s.time?.slice(0, 5) ?? '—'}</span>
								{#if s.durationMinutes}
									<span class="text-xs text-muted">{s.durationMinutes} min</span>
								{/if}
								{#if s.instructors.length > 0}
									<span class="text-xs text-muted">{s.instructors[0].instructorName}</span>
								{/if}
								<span class="text-xs capitalize text-muted ml-auto">{s.status}</span>
								{#if s.status !== 'cancelled'}
									<form method="POST" action="?/cancelEditionSession" use:enhance={withToast()}>
										<input type="hidden" name="sessionId" value={s.id} />
										<input type="hidden" name="editionId" value={activeEditionId} />
										<button type="submit" class="text-xs text-amber-600 hover:underline">Cancelar</button>
									</form>
								{/if}
								<form method="POST" action="?/deleteEditionSession" use:enhance={withToast()}>
									<input type="hidden" name="sessionId" value={s.id} />
									<input type="hidden" name="editionId" value={activeEditionId} />
									<button
										type="submit"
										onclick={(e) => { if (!confirm('¿Eliminar sesión?')) e.preventDefault(); }}
										class="text-xs text-red-600 hover:underline"
									>Eliminar</button>
								</form>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
