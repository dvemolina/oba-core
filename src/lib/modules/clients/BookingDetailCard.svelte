<script lang="ts">
    import { enhance } from '$app/forms';
    import { withToast } from '$lib/utils/enhance';
    import ClientSearchInput from '$lib/components/ClientSearchInput.svelte';
    import ContactButtons from '$lib/components/ContactButtons.svelte';
    import type { ServiceModules } from '$lib/features/services/modules';
    import type { BookingParticipant } from '$lib/features/bookings/types';

    interface Enrollment {
        id: string;
        clientId: string;
        clientFirstName: string | null;
        clientLastName: string | null;
        clientPhone: string | null;
        clientEmail: string | null;
        status: string;
        amountDue: string;
        amountPaid: string;
        paymentStatus: string;
        participantCount: number;
        creditSourceId: string | null;
        creditCount: number;
        priceOverride: string | null;
        overrideReason: string | null;
    }

    interface Booking {
        id: string;
        status: string;
        serviceMaxCapacity: number | null;
        serviceBasePrice: string | null;
        clients: Enrollment[];
    }

    interface Client {
        id: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        email: string | null;
    }

    let {
        booking,
        modules,
        clients = [],
        participantsByEnrollment = {},
        canSeeFinancials
    }: {
        booking: Booking;
        modules: ServiceModules;
        clients: Client[];
        participantsByEnrollment: Record<string, BookingParticipant[]>;
        canSeeFinancials: boolean;
    } = $props();

    const hasRoster = $derived('roster' in modules);
    const hasSessions = $derived('sessions' in modules);

    const activeClients = $derived(booking.clients.filter(c => c.status !== 'cancelled'));
    const cancelledClients = $derived(booking.clients.filter(c => c.status === 'cancelled'));
    const enrolled = $derived(activeClients.reduce((s, c) => s + (c.participantCount ?? 1), 0));
    const maxCapacity = $derived(booking.serviceMaxCapacity);
    const slotsLeft = $derived(maxCapacity != null ? maxCapacity - enrolled : null);
    const fillPct = $derived(maxCapacity ? (enrolled / maxCapacity) * 100 : 0);
    const enrolledIds = $derived(new Set(booking.clients.map(c => c.clientId)));

    let showCancelled = $state(false);
    let expandedParticipants = $state(new Set<string>());
    let editingParticipantId = $state<string | null>(null);
    let editingParticipantName = $state('');
    let addingParticipantFor = $state<string | null>(null);
    let newParticipantName = $state('');
    let selectedEnroll = $state<{ clientId: string; name: string } | null>(null);

    const paymentColors: Record<string, string> = {
        paid:    'bg-confirmed/15 text-green-700',
        partial: 'bg-pending/30 text-amber-700',
        pending: 'bg-gray-100 text-muted'
    };

    function toggleParticipants(bcId: string) {
        const next = new Set(expandedParticipants);
        next.has(bcId) ? next.delete(bcId) : next.add(bcId);
        expandedParticipants = next;
    }
</script>

<div class="rounded-(--radius-card) overflow-hidden border border-blue-100 bg-white">
    <!-- Card header -->
    <div class="flex items-center justify-between bg-blue-50 px-4 py-2.5">
        <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-blue-700">
                👥 Clientes
                {#if hasRoster && maxCapacity != null}
                    · {enrolled}/{maxCapacity} plazas
                {/if}
            </span>
        </div>
        {#if hasRoster && booking.status !== 'cancelled'}
            <span class="text-xs text-blue-500">+ Añadir cliente</span>
        {/if}
    </div>

    <!-- Capacity bar (roster only) -->
    {#if hasRoster && maxCapacity != null}
        <div class="h-1 bg-gray-100">
            <div class="h-1 bg-ocean transition-all" style="width: {Math.min(100, fillPct)}%"></div>
        </div>
        {#if slotsLeft != null && slotsLeft <= 2}
            <p class="bg-amber-50 px-4 py-1 text-xs text-amber-700">
                {slotsLeft > 0 ? `${slotsLeft} plaza${slotsLeft !== 1 ? 's' : ''} libre${slotsLeft !== 1 ? 's' : ''}` : 'Aforo completo'}
            </p>
        {/if}
    {/if}

    <!-- Active client rows -->
    <div class="divide-y divide-border/40">
        {#each activeClients as bc (bc.id)}
            {@const participants = participantsByEnrollment[bc.id] ?? []}
            {@const isExpanded = expandedParticipants.has(bc.id)}
            <div class="px-4 py-3 space-y-2">
                <!-- Client row -->
                <div class="flex items-center gap-2">
                    <div class="min-w-0 flex-1">
                        <span class="font-medium text-sm text-gray-900">
                            {bc.clientFirstName} {bc.clientLastName}
                        </span>
                        {#if bc.participantCount > 1}
                            <span class="ml-1 text-xs text-muted">· {bc.participantCount} participantes</span>
                        {/if}
                        {#if bc.creditSourceId}
                            <span class="ml-1 inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">🎟 Bono</span>
                        {/if}
                    </div>
                    <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium {paymentColors[bc.paymentStatus]}">
                        {bc.paymentStatus === 'paid' ? `€${bc.amountPaid} ✓` : bc.paymentStatus === 'partial' ? `€${bc.amountPaid}/€${bc.amountDue}` : `€${bc.amountDue} pendiente`}
                    </span>
                </div>

                <!-- Contact buttons -->
                {#if bc.clientPhone || bc.clientEmail}
                    <ContactButtons phone={bc.clientPhone} email={bc.clientEmail} />
                {/if}

                <!-- Participant count stepper -->
                <form method="POST" action="?/setParticipantCount" use:enhance={withToast()} class="flex items-center gap-2">
                    <input type="hidden" name="bookingClientId" value={bc.id} />
                    <span class="text-xs text-muted shrink-0">Participantes:</span>
                    <div class="flex items-center gap-1">
                        <button type="button" form=""
                            onclick={(e) => {
                                const inp = e.currentTarget.closest('form')?.querySelector('input[name=count]') as HTMLInputElement;
                                if (inp) inp.value = String(Math.max(1, parseInt(inp.value) - 1));
                            }}
                            class="h-6 w-6 rounded-full border border-border text-xs hover:bg-gray-50">−</button>
                        <input name="count" type="number" min="1" value={bc.participantCount ?? 1}
                            class="w-10 rounded border border-border px-1 py-0.5 text-center text-sm font-semibold focus:border-ocean focus:outline-none" />
                        <button type="button"
                            onclick={(e) => {
                                const inp = e.currentTarget.closest('form')?.querySelector('input[name=count]') as HTMLInputElement;
                                if (inp) inp.value = String(parseInt(inp.value) + 1);
                            }}
                            class="h-6 w-6 rounded-full border border-border text-xs hover:bg-gray-50">+</button>
                    </div>
                    <button type="submit" class="btn-secondary btn-sm text-xs">Set</button>
                </form>

                <!-- Named participants toggle + list -->
                <button type="button" onclick={() => toggleParticipants(bc.id)}
                    class="flex items-center gap-1 text-xs text-ocean hover:underline">
                    {#if isExpanded}▾{:else}▸{/if}
                    {participants.length > 0 ? `${participants.length} nombre${participants.length !== 1 ? 's' : ''}` : 'Nombrar participantes'}
                </button>

                {#if isExpanded}
                    {@const clientFullName = `${bc.clientFirstName} ${bc.clientLastName}`.trim()}
                    {@const clientAlreadyParticipant = participants.some(p => p.name === clientFullName)}
                    <div class="ml-2 space-y-1">
                        {#each participants as p (p.id)}
                            <div class="flex items-center gap-2">
                                {#if editingParticipantId === p.id}
                                    <form method="POST" action="?/renameParticipant" use:enhance={withToast(() => { editingParticipantId = null; })}
                                        class="flex flex-1 items-center gap-1">
                                        <input type="hidden" name="participantId" value={p.id} />
                                        <input name="name" type="text" bind:value={editingParticipantName}
                                            class="flex-1 rounded border border-border px-2 py-0.5 text-xs focus:border-ocean focus:outline-none" />
                                        <button type="submit" class="text-xs text-ocean hover:underline">✓</button>
                                        <button type="button" onclick={() => editingParticipantId = null} class="text-xs text-muted hover:text-gray-700">✕</button>
                                    </form>
                                {:else}
                                    <span class="flex-1 text-xs text-gray-700">{p.name}</span>
                                    <button type="button"
                                        onclick={() => { editingParticipantId = p.id; editingParticipantName = p.name; }}
                                        class="text-[10px] text-muted hover:text-ocean">editar</button>
                                    <form method="POST" action="?/removeBookingParticipant" use:enhance={withToast()}>
                                        <input type="hidden" name="participantId" value={p.id} />
                                        <button type="submit" class="text-[10px] text-red-400 hover:text-red-600">✕</button>
                                    </form>
                                {/if}
                            </div>
                        {/each}

                        <!-- Quick-add client as own participant -->
                        {#if !clientAlreadyParticipant}
                            <form method="POST" action="?/addBookingParticipant" use:enhance={withToast()}>
                                <input type="hidden" name="bookingClientId" value={bc.id} />
                                <input type="hidden" name="name" value={clientFullName} />
                                <input type="hidden" name="addToSessions" value={hasSessions ? 'true' : 'false'} />
                                <button type="submit" class="text-xs text-muted hover:text-ocean">
                                    ← {clientFullName} también participa
                                </button>
                            </form>
                        {/if}

                        <!-- Add participant inline form -->
                        {#if addingParticipantFor === bc.id}
                            <form method="POST" action="?/addBookingParticipant"
                                use:enhance={withToast(() => { addingParticipantFor = null; newParticipantName = ''; })}
                                class="flex items-center gap-1">
                                <input type="hidden" name="bookingClientId" value={bc.id} />
                                <input type="hidden" name="addToSessions" value="true" />
                                <input name="name" type="text" bind:value={newParticipantName} placeholder="Nombre..."
                                    class="flex-1 rounded border border-border px-2 py-0.5 text-xs focus:border-ocean focus:outline-none" />
                                <button type="submit" class="text-xs text-ocean hover:underline">+ Añadir</button>
                                <button type="button" onclick={() => addingParticipantFor = null} class="text-xs text-muted">✕</button>
                            </form>
                        {:else}
                            <button type="button" onclick={() => addingParticipantFor = bc.id}
                                class="text-xs text-ocean hover:underline">+ Nombrar participante</button>
                        {/if}

                        <!-- Sync all named participants to all sessions -->
                        {#if hasSessions && participants.length > 0}
                            <form method="POST" action="?/syncParticipantsToSessions" use:enhance={withToast()}>
                                <button type="submit" class="text-xs text-muted hover:text-purple-600">
                                    ↕ Sincronizar todos a sesiones
                                </button>
                            </form>
                        {/if}
                    </div>
                {/if}

                <!-- Per-enrollment payment and actions -->
                {#if canSeeFinancials}
                    <div class="flex items-center gap-2">
                        <!-- Update payment form -->
                        <form method="POST" action="?/updatePayment" use:enhance={withToast()} class="flex items-center gap-1">
                            <input type="hidden" name="bookingClientId" value={bc.id} />
                            <input type="hidden" name="amountDue" value={bc.amountDue} />
                            <input name="amountPaid" type="number" step="0.01" min="0"
                                value={bc.amountPaid}
                                placeholder="0"
                                class="w-20 rounded border border-border px-2 py-0.5 text-xs focus:border-ocean focus:outline-none" />
                            <button type="submit" class="text-xs text-ocean hover:underline">Pagar</button>
                        </form>

                        <!-- Cancel enrollment -->
                        {#if booking.status !== 'cancelled'}
                            <form method="POST" action="?/cancelClient" use:enhance={withToast()}>
                                <input type="hidden" name="bookingClientId" value={bc.id} />
                                <button type="submit" class="text-xs text-red-400 hover:text-red-600">Cancelar</button>
                            </form>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Add client search (roster only) -->
    {#if hasRoster && booking.status !== 'cancelled'}
        <div class="border-t border-border/40 px-4 py-3">
            <form method="POST" action="?/enroll" use:enhance={withToast(() => { selectedEnroll = null; })} class="space-y-2">
                <input type="hidden" name="clientId" value={selectedEnroll?.clientId ?? ''} />
                <input type="hidden" name="amountDue" value={booking.serviceBasePrice ?? '0'} />
                <ClientSearchInput
                    {clients}
                    excludeIds={[...enrolledIds]}
                    placeholder="Buscar cliente para añadir..."
                    onSelect={(c) => selectedEnroll = { clientId: c.id, name: `${c.firstName} ${c.lastName}`.trim() }}
                />
                {#if selectedEnroll}
                    <div class="flex items-center justify-between rounded-lg bg-ocean/5 px-3 py-1.5">
                        <span class="text-sm font-medium text-ocean">{selectedEnroll.name}</span>
                        <button type="submit" class="btn-primary btn-sm text-xs">Apuntar</button>
                    </div>
                {/if}
            </form>
        </div>
    {/if}

    <!-- Cancelled clients toggle -->
    {#if cancelledClients.length > 0}
        <div class="border-t border-border/40 px-4 py-2">
            <button type="button" onclick={() => showCancelled = !showCancelled}
                class="text-xs text-muted hover:text-gray-700">
                {showCancelled ? '▾' : '▸'} {cancelledClients.length} cancelado{cancelledClients.length !== 1 ? 's' : ''}
            </button>
            {#if showCancelled}
                <div class="mt-2 space-y-1">
                    {#each cancelledClients as bc (bc.id)}
                        <div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5">
                            <span class="text-xs text-muted line-through">{bc.clientFirstName} {bc.clientLastName}</span>
                            <form method="POST" action="?/reenrollClient" use:enhance={withToast()}>
                                <input type="hidden" name="bookingClientId" value={bc.id} />
                                <button type="submit" class="text-xs text-ocean hover:underline">Reapuntar</button>
                            </form>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>
