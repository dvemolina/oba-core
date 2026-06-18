<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getServiceColor } from '$lib/features/services/colors';
	import type { AgendaSession } from '$lib/features/sessions/types';

	let { session }: { session: AgendaSession } = $props();

	const color = $derived(getServiceColor(session.serviceColor ?? ''));

	function calendarPath(): string {
		const url = new URL($page.url);
		url.searchParams.delete('session');
		const search = url.searchParams.toString();
		return url.pathname + (search ? '?' + search : '');
	}

	function close() {
		const url = new URL($page.url);
		url.searchParams.delete('session');
		goto(url.toString(), { noScroll: true, replaceState: true });
	}

	function addMins(t: string, m: number): string {
		const [h, min] = t.split(':').map(Number);
		const total = h * 60 + min + m;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}

	const timeRange = $derived(
		session.time && session.durationMinutes
			? `${session.time.slice(0, 5)} – ${addMins(session.time.slice(0, 5), session.durationMinutes)}`
			: session.time?.slice(0, 5) ?? '—'
	);

	const statusBadge = $derived(
		session.status === 'cancelled' ? { label: 'Cancelada', cls: 'bg-red-100 text-red-700' } :
		session.status === 'completed' ? { label: 'Completada', cls: 'bg-green-100 text-green-700' } :
		session.status === 'unscheduled' ? { label: 'Sin horario', cls: 'bg-amber-100 text-amber-700' } :
		{ label: 'Activa', cls: 'bg-blue-100 text-blue-700' }
	);

	const ownerLabel = $derived(
		session.ownerType === 'service' ? 'Clase de grupo' :
		session.ownerType === 'edition' ? 'Campamento' : 'Clase privada'
	);

	const enrolledCount = $derived(session.bookingIds?.length ?? 0);
	const isGroup = $derived(session.ownerType === 'service' || session.ownerType === 'edition');

	const fullPageHref = $derived(
		`/sessions/${session.id}?from=${encodeURIComponent(calendarPath())}`
	);
</script>

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-40 bg-black/20"
	aria-label="Cerrar"
	onclick={close}
/>

<!-- Slide-over panel -->
<div
	transition:fly={{ x: 440, duration: 220 }}
	class="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
>
	<!-- Header -->
	<div class="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
		<div class="flex min-w-0 items-center gap-2">
			<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full {color.bg}"></span>
			<p class="truncate text-sm font-semibold text-navy">{session.serviceName ?? '—'}</p>
		</div>
		<div class="flex shrink-0 items-center gap-3">
			<a href={fullPageHref} class="text-xs font-medium text-indigo-600 hover:underline">Abrir completo →</a>
			<button
				type="button"
				onclick={close}
				class="rounded p-1 text-muted hover:bg-sand hover:text-navy"
				aria-label="Cerrar panel"
			>✕</button>
		</div>
	</div>

	<!-- Body -->
	<div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
		<!-- Session info card -->
		<div class="rounded-xl border-l-4 {color.border} {color.bg} p-4 ring-1 ring-border">
			<div class="flex items-start justify-between gap-2">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-wide text-muted">{ownerLabel}</p>
					<p class="mt-1 text-sm text-gray-700">
						{new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', {
							weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
						})}
					</p>
					<p class="mt-0.5 text-base font-bold text-navy">{timeRange}</p>
					{#if session.durationMinutes}
						<p class="text-xs text-muted">{session.durationMinutes} min</p>
					{/if}
					{#if session.instructors.length}
						<p class="mt-1.5 text-xs text-muted">
							Monitor: {session.instructors.map(i => i.instructorName).filter(Boolean).join(', ')}
						</p>
					{/if}
					{#if session.notes}
						<p class="mt-1.5 text-xs italic text-muted">{session.notes}</p>
					{/if}
				</div>
				<span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.cls}">{statusBadge.label}</span>
			</div>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 gap-3">
			{#if isGroup}
				<div class="rounded-lg bg-surface p-3 ring-1 ring-border">
					<p class="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Reservas</p>
					<p class="text-2xl font-bold text-navy">{enrolledCount}</p>
				</div>
			{:else if session.firstClientName}
				<div class="col-span-2 rounded-lg bg-surface p-3 ring-1 ring-border">
					<p class="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Cliente</p>
					<p class="text-sm font-semibold text-navy">{session.firstClientName}</p>
				</div>
			{/if}
			<div class="rounded-lg bg-surface p-3 ring-1 ring-border">
				<p class="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Participantes</p>
				<p class="text-2xl font-bold text-navy">{session.totalParticipants}</p>
			</div>
		</div>
	</div>

	<!-- Footer CTA -->
	<div class="border-t border-border px-5 py-4">
		<a
			href={fullPageHref}
			class="block w-full rounded-lg bg-ocean py-2.5 text-center text-sm font-semibold text-white hover:bg-ocean/90"
		>
			Ver sesión completa →
		</a>
	</div>
</div>
