<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { withToast } from '$lib/utils/enhance';
	import { User } from 'lucide-svelte';
	import type { Session } from '$lib/features/sessions/types';

	interface ServiceColor {
		bg: string;
		border: string;
		text?: string;
	}

	interface Instructor {
		id: string;
		name: string;
	}

	let {
		session,
		color,
		openHref,
		updateAction = '?/updateSession',
		cancelAction = '?/cancelSession',
		deleteAction,
		instructors = [],
		hiddenFields = {},
		participantNames,
		showDate = false,
		children,
		extraContent
	}: {
		session: Session;
		color: ServiceColor;
		openHref: string;
		updateAction?: string;
		cancelAction?: string;
		deleteAction?: string;
		instructors?: Instructor[];
		hiddenFields?: Record<string, string>;
		participantNames?: string[];
		showDate?: boolean;
		children?: Snippet;
		extraContent?: Snippet;
	} = $props();

	const chips = $derived(participantNames ?? session.participants.map(p => p.name));
	const displayDuration = $derived((session as any).effectiveDuration ?? session.durationMinutes);

	const isCancelled = $derived(session.status === 'cancelled');
	let editing = $state(false);

	function fmtTime(t: string | null) { return t?.slice(0, 5) ?? '—'; }
	function fmtDateShort(d: string) {
		return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
	}
	function endTime(t: string, m: number) {
		const [h, min] = t.split(':').map(Number);
		const total = h * 60 + min + m;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}
</script>

<div class="overflow-hidden rounded-xl border {isCancelled ? 'border-red-100 opacity-60' : 'border-gray-200'} bg-white shadow-sm">
	<!-- Main row: color bar + time + content -->
	<div class="flex items-stretch">
		<!-- Color bar -->
		<div class="w-1 shrink-0 rounded-l-xl {color.bg}"></div>

		<!-- Time block -->
		<div class="flex w-20 shrink-0 flex-col items-center justify-center border-r border-gray-100 bg-gray-50/60 py-3">
			{#if showDate}
				<p class="text-[9px] font-medium text-muted">{fmtDateShort(session.date)}</p>
			{/if}
			<p class="text-base font-bold leading-none text-green-600">{fmtTime(session.time)}</p>
			{#if session.time && displayDuration}
				<p class="mt-0.5 text-[10px] text-muted">{endTime(fmtTime(session.time), displayDuration)}</p>
				<p class="mt-1 text-[9px] text-gray-400">{displayDuration} min</p>
			{:else if !session.time}
				<p class="mt-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">sin hora</p>
			{/if}
		</div>

		<!-- Content -->
		<div class="min-w-0 flex-1 p-3">
			<!-- Header row: caller-provided context (service name, client, enrollment count…) + cancelled badge -->
			<div class="mb-1 flex items-start justify-between gap-1.5">
				<div class="min-w-0 flex-1">
					{#if children}
						{@render children()}
					{/if}
				</div>
				{#if isCancelled}
					<span class="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">Cancelada</span>
				{:else if session.status === 'completed'}
					<span class="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">Completada</span>
				{/if}
			</div>

			<!-- Instructor -->
			{#if session.instructors.length > 0}
				<p class="mb-1 flex items-center gap-1 text-[11px] text-muted">
					<User size={10} class="shrink-0" />
					{session.instructors.map(i => i.instructorName?.split(' ')[0]).filter(Boolean).join(', ')}
				</p>
			{/if}

			<!-- Participant chips -->
			{#if chips.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each chips as name}
						<span class="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700">{name}</span>
					{/each}
				</div>
			{/if}

			<!-- Notes -->
			{#if session.notes}
				<p class="mt-1 truncate text-[10px] italic text-gray-400">{session.notes}</p>
			{/if}
		</div>
	</div>

	<!-- Extra content area (e.g. enrolled clients list for group sessions) -->
	{#if extraContent}
		{@render extraContent()}
	{/if}

	<!-- Inline edit form -->
	{#if editing}
		<form method="POST" action={updateAction}
			use:enhance={withToast(() => { editing = false; })}
			class="grid grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50 px-3 py-3">
			{#each Object.entries(hiddenFields) as [k, v]}
				<input type="hidden" name={k} value={v} />
			{/each}
			<div>
				<label class="mb-0.5 block text-[10px] text-muted">Hora</label>
				<input name="time" type="time" value={session.time ?? ''} class="input w-full text-xs" />
			</div>
			<div>
				<label class="mb-0.5 block text-[10px] text-muted">Duración (min)</label>
				<input name="durationMinutes" type="number" min="1" value={displayDuration ?? ''} class="input w-full text-xs" />
			</div>
			{#if instructors.length > 0}
				<div class="col-span-2">
					<label class="mb-0.5 block text-[10px] text-muted">Monitor</label>
					<select name="instructorId" class="input w-full text-xs">
						<option value="">Sin asignar</option>
						{#each instructors as inst}
							<option value={inst.id} selected={session.instructors.some(i => i.instructorId === inst.id)}>
								{inst.name}
							</option>
						{/each}
					</select>
				</div>
			{/if}
			<div class="col-span-2">
				<label class="mb-0.5 block text-[10px] text-muted">Notas</label>
				<input name="notes" type="text" value={session.notes ?? ''} class="input w-full text-xs" />
			</div>
			<div class="col-span-2 flex gap-2">
				<button type="submit" class="btn-primary btn-sm text-xs">Guardar</button>
				<button type="button" onclick={() => editing = false} class="text-xs text-muted">Cancelar</button>
			</div>
		</form>
	{/if}

	<!-- Footer -->
	<div class="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-3 py-1.5">
		<div class="flex items-center gap-3">
			{#if !isCancelled}
				<button type="button" onclick={() => editing = !editing}
					class="text-[10px] text-gray-400 hover:text-gray-700">Editar</button>
				<form method="POST" action={cancelAction} use:enhance={withToast()}>
					{#each Object.entries(hiddenFields) as [k, v]}
						<input type="hidden" name={k} value={v} />
					{/each}
					<button type="submit"
						onclick={(e) => { if (!confirm('¿Cancelar sesión?')) e.preventDefault(); }}
						class="text-[10px] text-red-400 hover:text-red-600">Cancelar</button>
				</form>
			{/if}
			{#if deleteAction}
				<form method="POST" action={deleteAction} use:enhance={withToast()}>
					{#each Object.entries(hiddenFields) as [k, v]}
						<input type="hidden" name={k} value={v} />
					{/each}
					<button type="submit"
						onclick={(e) => { if (!confirm('¿Eliminar sesión?')) e.preventDefault(); }}
						class="text-[10px] text-gray-300 hover:text-red-500">Eliminar</button>
				</form>
			{/if}
		</div>
		<a href={openHref} class="text-[10px] text-ocean hover:underline">Abrir →</a>
	</div>
</div>
