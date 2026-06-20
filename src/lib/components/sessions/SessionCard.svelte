<script lang="ts">
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import type { Session } from '$lib/features/sessions/types';
	import type { BookingParticipant } from '$lib/features/bookings/types';

	interface Instructor {
		id: string;
		name: string;
	}

	interface ParticipantGroup {
		bookingId: string;
		clientName: string;
		isCurrentBooking: boolean;
		participants: { id: string; name: string; bookingParticipantId: string | null }[];
	}

	let {
		session,
		mode = 'booking',
		participantPool = [],
		participantGroups = [],
		instructors = [],
		bookingId = '',
		bookingStatus = 'confirmed',
		capacity = null,
		onLink
	}: {
		session: Session;
		mode?: 'booking' | 'service' | 'modal';
		participantPool?: BookingParticipant[];
		participantGroups?: ParticipantGroup[];
		instructors?: Instructor[];
		bookingId?: string;
		bookingStatus?: string;
		capacity?: number | null;
		onLink?: (sessionId: string) => void;
	} = $props();

	const dur = $derived(session.durationMinutes ?? 60);
	const takenCount = $derived(session.participants.length);
	const fillPct = $derived(capacity ? Math.min(100, (takenCount / capacity) * 100) : 0);
	const capacityColor = $derived(
		fillPct >= 100 ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-400' : 'bg-green-500'
	);

	const isCancelled = $derived(bookingStatus === 'cancelled' || session.status === 'cancelled');

	let editingTime = $state(false);
	let editTime = $state(session.time?.slice(0, 5) ?? '');
	let editDuration = $state(dur);

	function fmtDate(d: string) {
		return new Date(d + 'T00:00:00').toLocaleDateString('es', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}
</script>

<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
	<!-- Card body: stacked on mobile, side-by-side on md+ -->
	<div class="flex flex-col md:flex-row">

		<!-- LEFT PANEL: date + time + instructor -->
		<div class="border-b border-gray-100 bg-gray-50/60 p-3 md:w-[34%] md:border-b-0 md:border-r md:p-4">
			<div class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
				{fmtDate(session.date)}
			</div>
			{#if session.time}
				<div class="text-lg font-bold leading-tight text-green-600">
					{session.time.slice(0, 5)}
				</div>
				<div class="text-[11px] text-gray-400">{dur} min</div>
			{:else}
				<div class="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
					Sin horario
				</div>
			{/if}

			{#if instructors.length > 0 && mode !== 'modal'}
				<div class="mt-3 border-t border-gray-100 pt-3">
					<div class="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">Instructor</div>
					{#each instructors as inst (inst.id)}
						{@const assigned = session.instructors.some(si => si.instructorId === inst.id)}
						<label class="mb-1 flex cursor-pointer items-center gap-1.5">
							{#if !isCancelled && mode === 'booking'}
								<form method="post" action="?/updateSession" use:enhance={withToast()}>
									<input type="hidden" name="sessionId" value={session.id} />
									<input
										type="checkbox"
										name="sessionInstructorId"
										value={inst.id}
										checked={assigned}
										class="h-3 w-3 accent-green-600"
									/>
								</form>
							{:else}
								<input type="checkbox" checked={assigned} disabled class="h-3 w-3 accent-green-600" />
							{/if}
							<span class="text-[11px] text-gray-700">{inst.name}</span>
						</label>
					{/each}
				</div>
			{:else if session.instructors.length > 0}
				<div class="mt-2 text-[10px] text-gray-500">
					{session.instructors.map(i => i.instructorName).filter(Boolean).join(', ')}
				</div>
			{/if}
		</div>

		<!-- RIGHT PANEL: participants -->
		<div class="flex-1 p-3 md:p-4">
			<!-- Capacity header -->
			<div class="mb-2 flex items-center justify-between">
				<div class="text-[9px] font-bold uppercase tracking-wide text-gray-400">Participantes</div>
				<div class="flex items-center gap-2">
					<span class="text-[11px] font-bold text-gray-700">
						{takenCount}{capacity != null ? `/${capacity}` : ''}
					</span>
					{#if capacity != null}
						<div class="h-1 w-10 overflow-hidden rounded-full bg-gray-200">
							<div class="h-full rounded-full {capacityColor}" style="width:{fillPct}%"></div>
						</div>
					{/if}
				</div>
			</div>

			<!-- mode=booking: pool-based participant management -->
			{#if mode === 'booking'}
				{#if participantGroups.length > 0}
					<!-- Multi-booking view: grouped by booking -->
					{#each participantGroups as group (group.bookingId)}
						<div class="mb-3">
							<div class="mb-1">
								<span class="inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide
									{group.isCurrentBooking ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}">
									{group.clientName}{group.isCurrentBooking ? ' ← esta reserva' : ''}
								</span>
							</div>
							<div class="flex flex-col gap-1 border-l-2 pl-2
								{group.isCurrentBooking ? 'border-blue-300' : 'border-gray-200'}">
								{#each group.participants as sp (sp.id)}
									<div class="flex items-center justify-between rounded px-2 py-1
										{group.isCurrentBooking ? 'bg-blue-50' : 'bg-gray-50'}">
										<span class="text-[11px] {group.isCurrentBooking ? 'font-medium text-gray-900' : 'text-gray-400'}">
											✓ {sp.name}
										</span>
										{#if group.isCurrentBooking && !isCancelled}
											<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
												<input type="hidden" name="participantId" value={sp.id} />
												<button type="submit" class="text-[9px] text-gray-300 hover:text-red-400">remove</button>
											</form>
										{:else if !group.isCurrentBooking}
											<span class="text-[8px] text-gray-300">otra reserva</span>
										{/if}
									</div>
								{/each}
								{#if group.isCurrentBooking && !isCancelled}
									{#each participantPool as bp (bp.id)}
										{@const inSession = group.participants.some(sp => sp.bookingParticipantId === bp.id || sp.name === bp.name)}
										{#if !inSession}
											<form method="post" action="?/addParticipant" use:enhance={withToast()}
												class="flex items-center justify-between rounded px-2 py-1 hover:bg-blue-50/60">
												<input type="hidden" name="sessionId" value={session.id} />
												<input type="hidden" name="participantName" value={bp.name} />
												<input type="hidden" name="bookingParticipantId" value={bp.id} />
												<span class="text-[11px] text-gray-400">○ {bp.name}</span>
												<button type="submit" class="text-[9px] font-semibold text-green-600 hover:underline">add</button>
											</form>
										{/if}
									{/each}
								{/if}
							</div>
						</div>
					{/each}
				{:else}
					<!-- Simple pool: current booking's participants -->
					<div class="flex flex-col gap-1">
						{#each participantPool as bp (bp.id)}
							{@const sp = session.participants.find(p => p.bookingParticipantId === bp.id || p.name === bp.name)}
							{#if sp}
								<div class="flex items-center justify-between rounded bg-green-50 px-2 py-1">
									<span class="text-[11px] font-medium text-gray-900">✓ {bp.name}</span>
									{#if !isCancelled}
										<form method="post" action="?/removeParticipant" use:enhance={withToast()}>
											<input type="hidden" name="participantId" value={sp.id} />
											<button type="submit" class="text-[9px] text-gray-300 hover:text-red-400">remove</button>
										</form>
									{/if}
								</div>
							{:else if !isCancelled}
								<form method="post" action="?/addParticipant" use:enhance={withToast()}
									class="flex items-center justify-between rounded px-2 py-1 hover:bg-green-50/40">
									<input type="hidden" name="sessionId" value={session.id} />
									<input type="hidden" name="participantName" value={bp.name} />
									<input type="hidden" name="bookingParticipantId" value={bp.id} />
									<span class="text-[11px] text-gray-400">○ {bp.name}</span>
									<button type="submit" class="text-[9px] font-semibold text-green-600">add</button>
								</form>
							{:else}
								<div class="flex items-center rounded px-2 py-1 bg-gray-50">
									<span class="text-[11px] text-gray-400">○ {bp.name}</span>
								</div>
							{/if}
						{/each}
						{#if participantPool.length === 0}
							<p class="text-[11px] italic text-gray-400">Sin participantes configurados.</p>
						{/if}
					</div>
				{/if}

			<!-- mode=service or modal: flat participant list -->
			{:else}
				<div class="flex flex-col gap-1">
					{#each session.participants as p (p.id)}
						<div class="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
							<span class="text-[11px] text-gray-700">✓ {p.name}</span>
						</div>
					{/each}
					{#if session.participants.length === 0}
						<p class="text-[11px] italic text-gray-400">Sin participantes.</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- FOOTER -->
	<div class="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-3 py-1.5 md:px-4">
		<span class="rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize
			{session.status === 'scheduled' ? 'bg-green-100 text-green-700' :
			 session.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}">
			{session.status}
		</span>
		<div class="flex items-center gap-3">
			{#if mode === 'modal' && onLink}
				<button
					type="button"
					onclick={() => onLink!(session.id)}
					class="rounded-md bg-green-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-green-700">
					Vincular
				</button>
			{:else}
				{#if !isCancelled && mode === 'booking'}
					<button type="button" onclick={() => { editingTime = !editingTime; if (editingTime) { editTime = session.time?.slice(0,5) ?? ''; editDuration = dur; } }}
						class="text-[10px] text-gray-400 hover:text-gray-700">Editar</button>
				{/if}
				<a href="/sessions/{session.id}{bookingId ? '?from=/bookings/' + bookingId : ''}"
					class="text-[10px] text-blue-500 hover:underline">Abrir →</a>
				{#if !isCancelled && mode === 'booking' && session.status !== 'cancelled'}
					<form method="post" action="?/cancelSession" use:enhance={withToast()}>
						<input type="hidden" name="sessionId" value={session.id} />
						<button
							type="submit"
							onclick={(e) => { if (!confirm('¿Cancelar esta sesión?')) e.preventDefault(); }}
							class="text-[10px] text-red-400 hover:text-red-600">Cancelar</button>
					</form>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Inline edit panel (time/duration) -->
	{#if editingTime && mode === 'booking'}
		<form method="post" action="?/updateSession" use:enhance={withToast(() => { editingTime = false; })}
			class="border-t border-gray-100 px-4 py-3">
			<input type="hidden" name="sessionId" value={session.id} />
			<div class="flex flex-wrap gap-3">
				<div>
					<label class="block text-[10px] text-gray-400">Hora</label>
					<input name="sessionTime" type="time" bind:value={editTime} class="input mt-0.5 w-28 text-xs" />
				</div>
				<div>
					<label class="block text-[10px] text-gray-400">Duración (min)</label>
					<input name="sessionDuration" type="number" min="15" step="15" bind:value={editDuration}
						class="input mt-0.5 w-20 text-xs" />
				</div>
			</div>
			<div class="mt-2 flex gap-2">
				<button type="submit" class="btn-primary btn-sm text-xs">Guardar</button>
				<button type="button" onclick={() => editingTime = false} class="text-xs text-gray-400">Cancelar</button>
			</div>
		</form>
	{/if}
</div>
