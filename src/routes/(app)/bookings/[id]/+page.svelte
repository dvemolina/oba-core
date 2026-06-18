<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { withToast } from '$lib/utils/enhance';
	import { DOT_COLORS } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';
	import { Zap, Waves } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import { getLocale } from '$lib/paraglide/runtime';

	// Module cards
	import ClientsCard from '$lib/modules/clients/BookingDetailCard.svelte';
	import SessionsCard from '$lib/modules/sessions/BookingDetailCard.svelte';
	import InstructorCard from '$lib/modules/instructor/BookingDetailCard.svelte';
	import InventoryCard from '$lib/modules/inventory/BookingDetailCard.svelte';
	import CreditsCard from '$lib/modules/credits/BookingDetailCard.svelte';
	import PaymentCard from '$lib/modules/payment/BookingDetailCard.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Module flags (pure module checks — no type names)
	const modules = $derived(data.booking.serviceModules ?? {});
	const hasSessions = $derived('sessions' in modules || 'editions' in modules);
	const hasInventory = $derived('inventory' in modules);
	const hasInstructor = $derived('instructor' in modules);
	const hasCredits = $derived('credits' in modules);
	const hasDateRange = $derived(!!('editions' in modules && data.booking.dateEnd));

	const canSeeFinancials = $derived(data.canSeeFinancials);

	const statusColors: Record<string, string> = {
		confirmed: 'bg-confirmed/15 text-green-700',
		pending: 'bg-pending/30 text-amber-700',
		cancelled: 'bg-red-100 text-red-600'
	};

	let editing = $state(false);
	let editDate = $state(data.booking.date);
	let editTime = $state(data.booking.time?.slice(0, 5) ?? '');
	let editFlexible = $state(data.booking.isFlexible);
	let editInstructorId = $state(data.booking.instructorId ?? '');

	function openEdit() {
		editDate = data.booking.date;
		editTime = data.booking.time?.slice(0, 5) ?? '';
		editFlexible = data.booking.isFlexible;
		editInstructorId = data.booking.instructorId ?? '';
		editing = true;
	}

	let editingNotes = $state(false);
	let editNotesValue = $state(data.booking.notes ?? '');

	// Short booking ID for display (first 8 chars)
	const shortId = $derived(data.booking.id.slice(0, 8).toUpperCase());

	function fmtDateShort(d: Date | string): string {
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	const isNewBooking = $derived($page.url.searchParams.get('new') === '1');
	let confirmationDismissed = $state(false);

	function waMessage(bc: (typeof data.booking.clients)[number], type: 'confirmation' | 'reminder'): string {
		const service = data.booking.serviceName ?? 'tu reserva';
		const d = data.booking.date;
		const firstSession = data.sessions[0];
		const time = firstSession?.time
			? ` a las ${firstSession.time.slice(0, 5)}`
			: data.booking.time
				? ` a las ${data.booking.time.slice(0, 5)}`
				: '';
		if (type === 'confirmation')
			return `¡Hola ${bc.clientFirstName}! 🏄 Tu reserva de ${service} el ${d}${time} está confirmada. ¡Te esperamos! - OBA Surf`;
		return `¡Hola ${bc.clientFirstName}! 🌊 Te recordamos que mañana tienes ${service}${time}. ¡Hasta mañana! - OBA Surf`;
	}
	function waUrl(phone: string, message: string): string {
		return `https://wa.me/${phone.replace(/[\s\-()+]/g, '')}?text=${encodeURIComponent(message)}`;
	}
</script>

<div class="mx-auto max-w-lg space-y-4 p-4 md:p-6">
	<!-- Confirmation WhatsApp banner -->
	{#if isNewBooking && !confirmationDismissed && data.booking.clients.length > 0}
		{@const withPhone = data.booking.clients.filter((bc) => bc.status === 'enrolled' && bc.clientPhone)}
		{#if withPhone.length > 0}
			<div class="rounded-(--radius-card) border border-green-200 bg-green-50 p-4">
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm font-semibold text-green-800">¡Reserva creada! Envía la confirmación por WhatsApp:</p>
					<button
						type="button"
						onclick={() => (confirmationDismissed = true)}
						class="shrink-0 text-sm text-green-600 hover:text-green-800">✕</button
					>
				</div>
				<div class="mt-3 space-y-2">
					{#each withPhone as bc (bc.id)}
						<div class="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-green-100">
							<span class="text-sm font-medium text-gray-800">{bc.clientFirstName} {bc.clientLastName}</span>
							<a
								href={waUrl(bc.clientPhone!, waMessage(bc, 'confirmation'))}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
							>
								Confirmar
							</a>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Header -->
	<div class="flex items-start gap-3">
		<button
			onclick={() => (history.length > 1 ? history.back() : goto('/bookings'))}
			class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0">←</button
		>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-3 w-3 shrink-0 rounded-full"
					style="background-color: {DOT_COLORS[(data.booking.serviceColor ?? 'ocean') as ServiceColorKey] ?? DOT_COLORS['ocean']}"
				></span>
				<h1 class="truncate text-xl font-bold text-navy">{data.booking.serviceName ?? 'Reserva'}</h1>
			</div>
			<p class="mt-0.5 text-sm text-muted">
				{#if hasDateRange}
					{data.booking.date} → {data.booking.dateEnd}
				{:else}
					{data.booking.date}{data.booking.time ? ' · ' + data.booking.time.slice(0, 5) : ''}
					{#if data.booking.isFlexible}<Zap size={12} class="ml-1 inline text-flexible" />{/if}
				{/if}
			</p>
			{#if data.booking.serviceEditionId}
				<p class="mt-0.5 text-xs text-muted">
					Edición {data.booking.serviceEditionStartDate} → {data.booking.serviceEditionEndDate}
				</p>
			{/if}
		</div>
		<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
			{data.booking.status}
		</span>
	</div>

	<!-- Meta strip: booking ID, created, source -->
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-card) bg-sand px-4 py-2.5">
		<span class="font-mono text-[11px] font-semibold tracking-widest text-muted">#{shortId}</span>
		<span class="text-[10px] text-border">·</span>
		<span class="text-[11px] text-muted">Creada {fmtDateShort(data.booking.createdAt)}</span>
		{#if data.booking.updatedAt && data.booking.updatedAt.getTime() - data.booking.createdAt.getTime() > 60000}
			<span class="text-[10px] text-border">·</span>
			<span class="text-[11px] text-muted">Editada {fmtDateShort(data.booking.updatedAt)}</span>
		{/if}
		<span class="text-[10px] text-border">·</span>
		<span class="text-[11px] text-muted capitalize">{data.booking.source === 'whatsapp_bot' ? '🤖 WhatsApp bot' : '👤 Admin'}</span>
		<button type="button" onclick={openEdit}
			class="ml-auto text-[11px] font-medium text-ocean hover:underline">Editar reserva</button>
	</div>

	<!-- Notes card — always visible, inline edit -->
	<div class="rounded-(--radius-card) border border-border bg-surface">
		<div class="flex items-center justify-between px-4 py-2.5">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted">📝 Notas internas</p>
			{#if !editingNotes}
				<button type="button" onclick={() => { editNotesValue = data.booking.notes ?? ''; editingNotes = true; }}
					class="text-xs text-ocean hover:underline">{data.booking.notes ? 'Editar' : '+ Añadir'}</button>
			{/if}
		</div>
		{#if editingNotes}
			<form method="post" action="?/updateNotes"
				use:enhance={withToast(() => { editingNotes = false; })}
				class="border-t border-border/40 px-4 pb-3 pt-3">
				<textarea name="notes" rows="3" bind:value={editNotesValue} autofocus
					placeholder="Notas internas sobre esta reserva..."
					class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none"></textarea>
				<div class="mt-2 flex gap-2">
					<button type="submit" class="btn-primary btn-sm text-xs">Guardar</button>
					<button type="button" onclick={() => editingNotes = false} class="text-xs text-muted hover:text-gray-700">Cancelar</button>
				</div>
			</form>
		{:else if data.booking.notes}
			<p class="border-t border-border/40 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{data.booking.notes}</p>
		{:else}
			<p class="border-t border-border/40 px-4 py-3 text-xs italic text-border">Sin notas. Toca "+ Añadir" para agregar.</p>
		{/if}
	</div>

	<!-- Operational details (spot, instructor, date) — edit form -->
	{#if editing}
		<div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-ocean/40">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">Editar reserva</p>
				<button type="button" onclick={() => (editing = false)} class="text-xs text-muted hover:text-gray-700">Cancelar</button>
			</div>
			<form method="post" action="?/update" use:enhance={withToast(() => { editing = false; })} class="space-y-3">
				<input type="hidden" name="status" value={data.booking.status} />
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted" for="edit-date">Fecha</label>
						<input
							id="edit-date"
							name="date"
							type="date"
							bind:value={editDate}
							required
							class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
						/>
					</div>
					{#if !hasSessions}
						<div>
							<label class="mb-1 block text-xs text-muted" for="edit-time">Hora</label>
							<input
								id="edit-time"
								name="time"
								type="time"
								bind:value={editTime}
								disabled={editFlexible}
								class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40"
							/>
						</div>
					{/if}
				</div>
				{#if !hasSessions}
					<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
						<input type="checkbox" name="isFlexible" bind:checked={editFlexible} class="h-4 w-4 accent-ocean" />
						<Zap size={14} class="shrink-0" /> Horario flexible
					</label>
					{#if !hasInstructor}
						<div>
							<label class="mb-1 block text-xs text-muted" for="edit-instructor">Instructor</label>
							<select
								id="edit-instructor"
								name="instructorId"
								bind:value={editInstructorId}
								class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none"
							>
								<option value="">Sin asignar</option>
								{#each data.instructors as instructor (instructor.id)}
									<option value={instructor.id}>{instructor.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				{/if}
				<div>
					<label class="mb-1 block text-xs text-muted" for="edit-spot">Spot</label>
					<input
						id="edit-spot"
						name="spotNotes"
						value={data.booking.spotNotes ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
					/>
				</div>
				<button type="submit" class="btn-primary btn-block">Guardar</button>
			</form>
		</div>
	{:else if data.booking.spotNotes || (!hasSessions && data.booking.instructorName) || data.booking.sessionsIncluded != null}
		<!-- Read-only operational details — only shown if there's content -->
		<div class="space-y-2 rounded-(--radius-card) bg-surface px-4 py-3 ring-1 ring-border">
			{#if !hasSessions && data.booking.instructorName}
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted">Instructor</span>
					<span class="flex items-center gap-1.5 text-sm text-gray-800"
						><Waves size={13} class="shrink-0 text-ocean/60" />{data.booking.instructorName}</span>
				</div>
			{/if}
			{#if data.booking.sessionsIncluded != null}
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted">Sesiones contratadas</span>
					<span class="text-sm text-gray-800">{data.booking.sessionsIncluded}</span>
				</div>
			{/if}
			{#if data.booking.spotNotes}
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted">Spot</span>
					<span class="text-sm text-gray-800">{data.booking.spotNotes}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Module cards -->

	<ClientsCard
		booking={data.booking}
		{modules}
		clients={data.clients}
		participantsByEnrollment={data.participantsByEnrollment}
		{canSeeFinancials}
		availableCreditsPerEnrollment={data.availableCreditsPerEnrollment}
		editionEnrolledCount={data.editionEnrolledCount}
		editionMaxCapacity={data.editionMaxCapacity}
	/>

	{#if hasSessions}
		<SessionsCard
			booking={data.booking}
			{modules}
			sessions={data.sessions}
			allDateSessions={data.allDateSessions}
			sessionOwnerType={data.sessionOwnerType}
			instructors={data.instructors}
			participantsByEnrollment={data.participantsByEnrollment}
		/>
	{/if}

	{#if hasInstructor}
		<InstructorCard booking={data.booking} {modules} instructors={data.instructors} sessions={data.sessions} />
	{/if}

	{#if hasInventory}
		<InventoryCard
			booking={data.booking}
			{modules}
			serviceInventoryLinks={data.serviceInventoryLinks}
			itemsByAllocType={data.itemsByAllocType}
			allocTypeTracking={data.allocTypeTracking}
		/>
	{/if}

	{#if hasCredits}
		<CreditsCard booking={data.booking} {modules}
			creditsUsed={data.creditsUsedFromThisBooking}
			bookingDate={data.booking.date} />
	{/if}

	<PaymentCard booking={data.booking} {modules} {canSeeFinancials}
		servicePricingMode={data.service?.pricingMode ?? null}
		sessionsIncluded={data.sessions.filter(s => s.status !== 'cancelled').length || (data.booking.sessionsIncluded ?? null)} />

	<!-- Cancel / Delete actions -->
	{#if data.booking.status !== 'cancelled' && data.userRole !== 'staff'}
		<div class="flex gap-2">
			<form method="POST" action="?/cancel" use:enhance={withToast()} class="flex-1">
				<button type="submit" class="btn-secondary btn-block text-amber-700"> Cancelar reserva </button>
			</form>
			{#if data.userRole === 'owner' || data.userRole === 'admin'}
				<form
					method="POST"
					action="?/delete"
					use:enhance={({ cancel }) => {
						if (!confirm('¿Eliminar esta reserva?')) {
							cancel();
							return;
						}
						return withToast(() => goto('/bookings'))();
					}}
					class="flex-1"
				>
					<button type="submit" class="btn-secondary btn-block text-red-600"> Eliminar reserva </button>
				</form>
			{/if}
		</div>
	{/if}
</div>
