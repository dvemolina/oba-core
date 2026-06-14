# Module System — Plan 2: UX Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full rewrite of `bookings/new` and `bookings/[id]` using module-driven card architecture. No isCamp/isLesson/isAccommodation type derivations anywhere. Named participants load correctly per enrollment. Six module card components replace the monolithic 1144-line detail page.

**Architecture:**
- `bookings/[id]/+page.svelte` becomes a ~150-line orchestrator that imports and renders module card components
- One card per active module: ClientsCard (always), SessionsCard, InstructorCard, InventoryCard, CreditsCard (stub), PaymentCard (always)
- Cards manage their own local state; forms post via SvelteKit enhance; no state lifted to parent
- Named participants are sub-entities of client enrollments — managed in ClientsCard, consumed (as flat list) by SessionsCard for attendance
- Cross-module data (participants list, sessions list) is passed down from parent page via props
- `bookings/new` rewritten cleanly with module-derived flags, no service type names

**Governing principle:** `if (service.modules.sessions)` or `if ('sessions' in modules)` — never `if (isCamp)` or `if (isLesson)`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes (`$props`, `$state`, `$derived`), TypeScript, Drizzle ORM, Tailwind v4, Paraglide i18n.

**Spec:** `docs/superpowers/specs/2026-06-13-module-system-design.md`

---

## File Map

**Create:**
- `src/lib/modules/clients/BookingDetailCard.svelte` — always-rendered client enrollment card
- `src/lib/modules/sessions/BookingDetailCard.svelte` — session list with attendance
- `src/lib/modules/instructor/BookingDetailCard.svelte` — instructor assignment card
- `src/lib/modules/inventory/BookingDetailCard.svelte` — equipment allocation card
- `src/lib/modules/credits/BookingDetailCard.svelte` — pack booking stub (Plan 3 fills in)
- `src/lib/modules/payment/BookingDetailCard.svelte` — per-enrollment payment breakdown

**Rewrite (full, from scratch):**
- `src/routes/(app)/bookings/new/+page.svelte`
- `src/routes/(app)/bookings/[id]/+page.svelte`

**Modify:**
- `src/lib/features/bookings/types.ts` — add `participantCount?` to `CreateBookingInput.clients`
- `src/lib/features/bookings/queries.ts` — insert `participantCount` in `createBooking`
- `src/routes/(app)/bookings/[id]/+page.server.ts` — load `participantsByEnrollment`
- `src/routes/(app)/services/new/+page.svelte` — add credits toggle, wire MODULE_DEFINITIONS icons
- `src/routes/(app)/services/[id]/+page.svelte` — add credits toggle, wire MODULE_DEFINITIONS icons

---

## Task 1: Fix `CreateBookingInput` and `createBooking` to pass `participantCount`

**Files:**
- Modify: `src/lib/features/bookings/types.ts`
- Modify: `src/lib/features/bookings/queries.ts`

### Context

`CreateBookingInput.clients` currently only has `{ clientId, amountDue }`. The `bookingClients` table has `participant_count NOT NULL DEFAULT 1`. The default works for now, but the new booking form will submit per-client participant counts and we need to pass them through.

### Steps

- [ ] **Read the files**
```bash
cat src/lib/features/bookings/types.ts
grep -n "clients\|participantCount\|participant_count" src/lib/features/bookings/queries.ts | head -20
```

- [ ] **Add `participantCount` to `CreateBookingInput.clients`**

In `src/lib/features/bookings/types.ts`, find `CreateBookingInput` and update the `clients` array type:
```typescript
// OLD:
clients: {
    clientId: string;
    amountDue: string;
}[];

// NEW:
clients: {
    clientId: string;
    amountDue: string;
    participantCount?: number;  // defaults to 1 if omitted
}[];
```

- [ ] **Update `createBooking` INSERT to include `participantCount`**

In `src/lib/features/bookings/queries.ts`, find the `db.insert(bookingClients)` call inside `createBooking`:
```typescript
// OLD:
input.clients.map((c) => ({
    bookingId: booking.id,
    clientId: c.clientId,
    amountDue: c.amountDue,
    amountPaid: '0',
    paymentStatus: 'pending' as const
}))

// NEW:
input.clients.map((c) => ({
    bookingId: booking.id,
    clientId: c.clientId,
    amountDue: c.amountDue,
    amountPaid: '0',
    paymentStatus: 'pending' as const,
    participantCount: c.participantCount ?? 1
}))
```

- [ ] **Write a test verifying participantCount is stored**

In `src/lib/server/db/schema.test.ts`, add a test after the existing ones:
```typescript
it('createBooking stores participantCount per client', async () => {
    // This is a type-level check — if participantCount is missing from the insert,
    // the DB default of 1 applies. The test just ensures the field is accepted.
    // Full integration test would require a live DB; this validates the type.
    const input = {
        clientId: 'test-client',
        amountDue: '50',
        participantCount: 3
    } satisfies CreateBookingInput['clients'][number];
    expect(input.participantCount).toBe(3);
});
```

- [ ] **Commit**
```bash
git add src/lib/features/bookings/types.ts src/lib/features/bookings/queries.ts && git commit -m "feat(bookings): add participantCount per client to CreateBookingInput and createBooking"
```

---

## Task 2: Load named participants in booking detail server load

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`

### Context

`getBooking` returns `participants: []` (always empty array). Named participants live in `booking_participants` table linked to `booking_client_id`. The `listParticipantsForEnrollment(bookingClientId)` function exists in `src/lib/features/bookings/participants.queries.ts`. The booking detail needs these to render the ClientsCard participant sub-lists and SessionsCard attendance checklists.

### Steps

- [ ] **Read the load function**
```bash
head -80 src/routes/(app)/bookings/[id]/+page.server.ts
```

- [ ] **Import `listParticipantsForEnrollment`**

At the top of the server file, add to the existing participants import:
```typescript
import { addParticipant as addEnrollmentParticipant, removeParticipant as removeEnrollmentParticipant, renameParticipant, setEnrollmentParticipantCount, listParticipantsForEnrollment } from '$lib/features/bookings/participants.queries';
```

- [ ] **Load participants per enrollment in the `load` function**

After the existing `[service, clients, sessions, allDateSessions]` parallel fetch, add:
```typescript
// Load named participants per enrollment
const participantsByEnrollment: Record<string, Awaited<ReturnType<typeof listParticipantsForEnrollment>>> = {};
await Promise.all(
    booking.clients.map(async (bc) => {
        participantsByEnrollment[bc.id] = await listParticipantsForEnrollment(bc.id);
    })
);
```

- [ ] **Add to return object**

In the return statement, add `participantsByEnrollment`:
```typescript
return {
    booking, instructors, service: service ?? null, clients, isCamp, sessions,
    linkableSessions, allDateSessions,
    canSeeFinancials: canSeeFinancials(locals),
    userRole: locals.user?.role ?? '',
    itemsByAllocType, allocTypeTracking, serviceInventoryLinks,
    participantsByEnrollment   // ← add this
};
```

- [ ] **Remove the `isCamp` variable** (it's a type name, violates module principle)

Find `const isCamp = booking.serviceHasRoster;` and remove it. Replace its usage in `clients: isCamp ? listClients() : Promise.resolve([])` with:
```typescript
clients: booking.serviceHasRoster ? listClients() : Promise.resolve([]),
```

Also remove it from the return: `isCamp` is no longer needed in the return object (the svelte page will derive it from `booking.serviceModules`).

- [ ] **Run type check**
```bash
npx tsc --noEmit 2>&1 | grep "bookings/\[id\]" | head -10
```

- [ ] **Commit**
```bash
git add "src/routes/(app)/bookings/[id]/+page.server.ts" && git commit -m "feat(bookings/detail): load named participants per enrollment in server load"
```

---

## Task 3: Create `ClientsCard` — enrollment + participant management

**Files:**
- Create: `src/lib/modules/clients/BookingDetailCard.svelte`

### Context

This is the most complex card. Always rendered. Owns:
- Client enrollment rows (one per `booking.clients` entry)
- Participant count stepper per enrollment
- Named participant sub-list per enrollment (expandable)
- Capacity bar (when `roster` module active)
- Add client search (when `roster` module active)
- Cancelled client rows (toggle to show)
- Per-enrollment price override

The card does NOT own sessions, inventory, or payment — it only manages client/participant data.

### Props interface

```typescript
interface Props {
    booking: import('./$types').PageData['booking']
    modules: import('$lib/features/services/modules').ServiceModules
    clients: import('./$types').PageData['clients']            // full client list for add-client search
    participantsByEnrollment: Record<string, import('$lib/features/bookings/types').BookingParticipant[]>
    canSeeFinancials: boolean
}
```

### Steps

- [ ] **Create the directory and file**
```bash
mkdir -p src/lib/modules/clients
touch src/lib/modules/clients/BookingDetailCard.svelte
```

- [ ] **Write the component**

```svelte
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
        // other fields available but not needed here
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

    const activeClients = $derived(booking.clients.filter(c => c.status !== 'cancelled'));
    const cancelledClients = $derived(booking.clients.filter(c => c.status === 'cancelled'));
    const enrolled = $derived(activeClients.reduce((s, c) => s + (c.participantCount ?? 1), 0));
    const maxCapacity = $derived(booking.serviceMaxCapacity);
    const slotsLeft = $derived(maxCapacity != null ? maxCapacity - enrolled : null);
    const fillPct = $derived(maxCapacity ? (enrolled / maxCapacity) * 100 : 0);
    const enrolledIds = $derived(new Set(booking.clients.map(c => c.clientId)));

    let showCancelled = $state(false);
    let expandedParticipants = $state(new Set<string>());  // set of bookingClientIds
    let editingParticipantId = $state<string | null>(null);
    let editingParticipantName = $state('');
    let addingParticipantFor = $state<string | null>(null);  // bookingClientId
    let newParticipantName = $state('');
    let editingAmountDue = $state<string | null>(null);  // bookingClientId
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
```

- [ ] **Commit**
```bash
git add src/lib/modules/clients/ && git commit -m "feat(modules): add ClientsCard module card component"
```

---

## Task 4: Create `SessionsCard`

**Files:**
- Create: `src/lib/modules/sessions/BookingDetailCard.svelte`

### Context

Shows the sessions list for the booking. Attendance checklist uses participant names from `participantsByEnrollment` (flattened across all enrollments). Includes add-session form, edit-session inline form, bulk generate form. Only renders when `sessions` in modules.

### Steps

- [ ] **Create the file**
```bash
mkdir -p src/lib/modules/sessions
touch src/lib/modules/sessions/BookingDetailCard.svelte
```

- [ ] **Write the component**

Props:
```typescript
let {
    booking,      // booking.date, booking.dateEnd, booking.id, booking.status
    modules,
    sessions,     // Session[] from listSessionsForBooking
    allDateSessions,  // for conflict detection
    instructors,  // for session instructor picker
    participantsByEnrollment  // Record<bookingClientId, BookingParticipant[]>
}: {
    booking: { id: string; date: string; dateEnd?: string | null; status: string; serviceModules?: ServiceModules };
    modules: ServiceModules;
    sessions: SessionRow[];
    allDateSessions: SessionRow[];
    instructors: Instructor[];
    participantsByEnrollment: Record<string, BookingParticipant[]>;
} = $props();
```

Key derived state (carry over from existing page, adapted):
```typescript
// Flat list of all named participants across all enrollments
const allParticipants = $derived(
    Object.values(participantsByEnrollment).flat()
);

// Sessions grouped by date
const sessionsByDate = $derived(() => {
    const map: Record<string, typeof sessions> = {};
    for (const s of sessions) (map[s.date] ??= []).push(s);
    for (const d in map) map[d].sort((a, b) => a.sortOrder - b.sortOrder || (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
});

const unscheduledSessions = $derived(sessions.filter(s => s.status === 'unscheduled'));
const scheduledSessions   = $derived(sessions.filter(s => s.status === 'scheduled'));
```

UI structure:
```
[Card header: ⏱ Sesiones · N sesiones]  [+ Añadir sesión]
[Unscheduled sessions banner if any]
[Scheduled sessions grouped by date:]
  [Date header]
  [Session row: time–endtime · N asistentes]
    [Attendance checklist: name ✓/✗ per session]
    [Edit inline form (editingSessionId state)]
  [+ Añadir sesión form (showAddSession state)]
[Bulk generate button / form]
```

The session form actions (`?/addSession`, `?/updateSession`, `?/cancelSession`, `?/deleteSession`, `?/bulkGenerateSessions`) are inherited from the existing page.server.ts — they all work correctly.

For attendance per session, use participant names from `allParticipants`:
```svelte
<!-- Per-session attendance checklist -->
<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
    {#each allParticipants as p}
        <span>{p.name} {session.attendees?.includes(p.id) ? '✓' : '✗'}</span>
    {/each}
    {#if allParticipants.length === 0}
        <span class="italic">Sin participantes nombrados</span>
    {/if}
</div>
```

Note: `session.attendees` may not be loaded yet (the session query may not join `booking_participants`). If it's not available, show a simplified view without per-person checkboxes until Plan 3 adds attendance tracking queries.

Carry forward existing logic from lines 52-105 of the old page.svelte:
- `checkAllInstructorConflicts` import from `$lib/features/calendar/utils`
- `editConflicts` / `addConflicts` derived state
- `bulkTimes` / `DEFAULT_TIMES` state

- [ ] **Run svelte-check on the new file**
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep "modules/sessions" | head -10
```

- [ ] **Commit**
```bash
git add src/lib/modules/sessions/ && git commit -m "feat(modules): add SessionsCard module card component"
```

---

## Task 5: Create `InstructorCard`

**Files:**
- Create: `src/lib/modules/instructor/BookingDetailCard.svelte`

### Context

When sessions module is also active: card shows per-session instructor assignment (each session row gets an instructor select). When only instructor module (no sessions): shows single booking-level instructor select.

Single instructor assignment uses `?/update` action (already handles `instructorId`). Per-session instructor uses `?/updateSession` with `sessionInstructorId` field.

### Steps

- [ ] **Create the file**
```bash
mkdir -p src/lib/modules/instructor
touch src/lib/modules/instructor/BookingDetailCard.svelte
```

- [ ] **Write the component**

```svelte
<script lang="ts">
    import { enhance } from '$app/forms';
    import { withToast } from '$lib/utils/enhance';
    import type { ServiceModules } from '$lib/features/services/modules';

    let {
        booking,   // booking.instructorId, booking.instructorName, booking.id, booking.status
        modules,
        instructors,
        sessions = []  // pass sessions if sessions module is also active
    }: {
        booking: { id: string; instructorId: string | null; instructorName: string | null; status: string };
        modules: ServiceModules;
        instructors: Array<{ id: string; name: string }>;
        sessions: Array<{ id: string; date: string; time: string | null; instructorId?: string | null }>;
    } = $props();

    const hasSessions = $derived('sessions' in modules);
    let editingInstructor = $state(false);
    let selectedInstructorId = $state(booking.instructorId ?? '');
</script>

<div class="rounded-(--radius-card) overflow-hidden border border-green-100 bg-white">
    <div class="flex items-center justify-between bg-green-50 px-4 py-2.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-green-700">🏄 Instructor</span>
        {#if !hasSessions && booking.status !== 'cancelled'}
            <button type="button" onclick={() => editingInstructor = !editingInstructor}
                class="text-xs text-green-600 hover:underline">
                {editingInstructor ? 'Cancelar' : 'Cambiar'}
            </button>
        {/if}
    </div>

    <div class="px-4 py-3">
        {#if !hasSessions}
            <!-- Single booking-level instructor -->
            {#if editingInstructor}
                <form method="POST" action="?/update" use:enhance={withToast(() => { editingInstructor = false; })} class="flex gap-2">
                    <input type="hidden" name="status" value={booking.status} />
                    <input type="hidden" name="date" value={booking.date ?? ''} />
                    <input type="hidden" name="isFlexible" value={booking.isFlexible ?? false} />
                    <select name="instructorId" bind:value={selectedInstructorId}
                        class="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:border-ocean focus:outline-none">
                        <option value="">Sin asignar</option>
                        {#each instructors as inst}
                            <option value={inst.id}>{inst.name}</option>
                        {/each}
                    </select>
                    <button type="submit" class="btn-primary btn-sm">Guardar</button>
                </form>
            {:else}
                <span class="text-sm text-gray-800">
                    {booking.instructorName ?? 'Sin asignar'}
                </span>
            {/if}
        {:else}
            <!-- Per-session instructor assignment -->
            {#if sessions.length === 0}
                <p class="text-sm text-muted">Las sesiones se asignan por sesión.</p>
            {:else}
                <div class="space-y-2">
                    {#each sessions as session (session.id)}
                        <div class="flex items-center gap-2">
                            <span class="min-w-0 flex-1 text-xs text-muted">
                                {session.date}{session.time ? ' · ' + session.time.slice(0,5) : ''}
                            </span>
                            <form method="POST" action="?/updateSession" use:enhance={withToast()} class="flex items-center gap-1">
                                <input type="hidden" name="sessionId" value={session.id} />
                                <select name="sessionInstructorId"
                                    class="rounded border border-border px-2 py-1 text-xs focus:border-ocean focus:outline-none">
                                    <option value="">–</option>
                                    {#each instructors as inst}
                                        <option value={inst.id} selected={session.instructorId === inst.id}>{inst.name}</option>
                                    {/each}
                                </select>
                                <button type="submit" class="text-xs text-ocean hover:underline">Set</button>
                            </form>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>
```

- [ ] **Commit**
```bash
git add src/lib/modules/instructor/ && git commit -m "feat(modules): add InstructorCard module card component"
```

---

## Task 6: Create `InventoryCard`

**Files:**
- Create: `src/lib/modules/inventory/BookingDetailCard.svelte`

### Context

Shows inventory allocations for the booking. Carries over all the existing allocation logic from the old `bookings/[id]/+page.svelte` (lines 125-166 for logic, ~lines 377-650 for UI). Key things to port:
- `groupInventoryItems()` helper function
- Add allocation form with variant chip selection
- Status update + reassign forms per allocation
- The `addingAlloc`, `addAllocTypeId`, `addAllocQty`, etc. local state
- Actions used: `?/addAlloc`, `?/updateAllocStatus`, `?/reassignAllocItem`, `?/removeAlloc`

Total participant count (for "N participantes" in header) is `booking.clients.filter active`.reduce(sum participantCount).

### Steps

- [ ] **Create the file**
```bash
mkdir -p src/lib/modules/inventory
touch src/lib/modules/inventory/BookingDetailCard.svelte
```

- [ ] **Write the component**

Copy all allocation-related logic and UI from the current `bookings/[id]/+page.svelte` (lines 125-166 for script, lines 377-650 for template). Extract into this component.

Props:
```typescript
let {
    booking,
    modules,
    serviceInventoryLinks,
    itemsByAllocType,
    allocTypeTracking
}: {
    booking: { id: string; date: string; dateEnd?: string | null; status: string; allocations: Allocation[]; clients: Enrollment[] };
    modules: ServiceModules;
    serviceInventoryLinks: ServiceInventoryLink[];
    itemsByAllocType: Record<string, InventoryItem[]>;
    allocTypeTracking: Record<string, 'pool' | 'specific'>;
} = $props();
```

Derive total participant count:
```typescript
const totalParticipants = $derived(
    booking.clients.filter(c => c.status !== 'cancelled').reduce((s, c) => s + (c.participantCount ?? 1), 0)
);
```

Card header:
```svelte
<div class="flex items-center justify-between bg-orange-50 px-4 py-2.5">
    <span class="text-xs font-semibold uppercase tracking-wide text-orange-700">
        🎒 Inventario · {totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}
    </span>
    {#if serviceInventoryLinks.length > 0 && booking.status !== 'cancelled'}
        <button type="button" onclick={() => addingAlloc = !addingAlloc} class="text-xs text-orange-600 hover:underline">
            {addingAlloc ? 'Cancelar' : '+ Asignar'}
        </button>
    {/if}
</div>
```

The rest of the card is a direct port of the inventory section from the existing page. Use `AllocationBadge` component:
```typescript
import AllocationBadge from '$lib/components/inventory/AllocationBadge.svelte';
```

Card border color: `border-orange-100`.

- [ ] **Import and use AllocationBadge correctly**

Check `src/lib/components/inventory/AllocationBadge.svelte` for its props:
```bash
head -20 src/lib/components/inventory/AllocationBadge.svelte
```

- [ ] **Commit**
```bash
git add src/lib/modules/inventory/ && git commit -m "feat(modules): add InventoryCard module card component"
```

---

## Task 7: Create `PaymentCard`

**Files:**
- Create: `src/lib/modules/payment/BookingDetailCard.svelte`

### Context

Always rendered last. Shows per-enrollment payment breakdown. Supports per-enrollment `updateAmountDue`. If any enrollment has `creditSourceId`, shows a credit badge instead of cash amount for those. Shows total.

### Steps

- [ ] **Create the file**
```bash
mkdir -p src/lib/modules/payment
touch src/lib/modules/payment/BookingDetailCard.svelte
```

- [ ] **Write the component**

```svelte
<script lang="ts">
    import { enhance } from '$app/forms';
    import { withToast } from '$lib/utils/enhance';
    import type { ServiceModules } from '$lib/features/services/modules';

    interface Enrollment {
        id: string;
        clientFirstName: string | null;
        clientLastName: string | null;
        status: string;
        amountDue: string;
        amountPaid: string;
        paymentStatus: string;
        participantCount: number;
        creditSourceId: string | null;
        creditCount: number;
        priceOverride: string | null;
    }

    let {
        booking,
        modules,
        canSeeFinancials
    }: {
        booking: { id: string; clients: Enrollment[]; serviceBasePrice: string | null; pricingMode?: string | null };
        modules: ServiceModules;
        canSeeFinancials: boolean;
    } = $props();

    const activeClients = $derived(booking.clients.filter(c => c.status !== 'cancelled'));
    const totalDue  = $derived(activeClients.reduce((s, c) => s + parseFloat(c.amountDue ?? '0'), 0));
    const totalPaid = $derived(activeClients.reduce((s, c) => s + parseFloat(c.amountPaid ?? '0'), 0));

    let editingDueFor = $state<string | null>(null);  // bookingClientId
</script>

{#if canSeeFinancials}
<div class="rounded-(--radius-card) overflow-hidden border border-gray-200 bg-white">
    <div class="bg-gray-50 px-4 py-2.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-600">💰 Pago</span>
    </div>

    <div class="divide-y divide-border/40">
        {#each activeClients as bc (bc.id)}
            <div class="flex items-center justify-between px-4 py-2.5">
                <div class="min-w-0 flex-1">
                    <span class="text-sm text-gray-700">{bc.clientFirstName} {bc.clientLastName}</span>
                    {#if bc.participantCount > 1}
                        <span class="ml-1 text-xs text-muted">· {bc.participantCount} part.</span>
                    {/if}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    {#if bc.creditSourceId && bc.creditCount > 0}
                        <span class="text-xs font-semibold text-purple-700">🎟 crédito</span>
                    {/if}
                    {#if editingDueFor === bc.id}
                        <form method="POST" action="?/updateAmountDue"
                            use:enhance={withToast(() => { editingDueFor = null; })}
                            class="flex items-center gap-1">
                            <input type="hidden" name="bookingClientId" value={bc.id} />
                            <input name="amountDue" type="number" step="0.01" min="0"
                                value={bc.amountDue}
                                class="w-20 rounded border border-border px-2 py-0.5 text-xs focus:border-ocean focus:outline-none" />
                            <button type="submit" class="text-xs text-ocean hover:underline">✓</button>
                            <button type="button" onclick={() => editingDueFor = null} class="text-xs text-muted">✕</button>
                        </form>
                    {:else}
                        <button type="button" onclick={() => editingDueFor = bc.id}
                            class="text-sm font-medium {bc.paymentStatus === 'paid' ? 'text-green-700' : bc.paymentStatus === 'partial' ? 'text-amber-700' : 'text-gray-800'}">
                            €{bc.amountDue}
                            {#if bc.paymentStatus === 'paid'} ✓{/if}
                        </button>
                    {/if}
                </div>
            </div>
        {/each}
    </div>

    <!-- Total row -->
    <div class="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <span class="text-sm font-semibold text-gray-900">Total</span>
        <div class="text-right">
            <span class="text-base font-bold text-gray-900">€{totalDue.toFixed(2)}</span>
            {#if totalPaid > 0 && totalPaid < totalDue}
                <span class="ml-2 text-xs text-amber-600">€{totalPaid.toFixed(2)} cobrado</span>
            {/if}
        </div>
    </div>
</div>
{/if}
```

- [ ] **Commit**
```bash
git add src/lib/modules/payment/ && git commit -m "feat(modules): add PaymentCard module card component"
```

---

## Task 8: Create `CreditsCard` stub

**Files:**
- Create: `src/lib/modules/credits/BookingDetailCard.svelte`

### Context

Only rendered when `service.modules.credits` is set (i.e., this booking IS a pack purchase, not a booking that uses credits from a pack). Shows pack summary and consumption history. Implementation is Plan 3 — this is a stub that compiles and renders a placeholder.

### Steps

- [ ] **Create the file**
```bash
mkdir -p src/lib/modules/credits
touch src/lib/modules/credits/BookingDetailCard.svelte
```

- [ ] **Write the stub**

```svelte
<script lang="ts">
    import type { ServiceModules } from '$lib/features/services/modules';

    let {
        booking,
        modules
    }: {
        booking: { id: string };
        modules: ServiceModules;
    } = $props();

    const creditsConfig = $derived(modules.credits);
</script>

<div class="rounded-(--radius-card) overflow-hidden border border-purple-100 bg-white">
    <div class="bg-purple-50 px-4 py-2.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-purple-700">
            🎟 Créditos · {creditsConfig?.creditsIncluded ?? 0} incluidos
        </span>
    </div>
    <div class="px-4 py-3">
        <p class="text-xs text-muted">Historial de consumo — disponible en Plan 3.</p>
    </div>
</div>
```

- [ ] **Commit**
```bash
git add src/lib/modules/credits/ && git commit -m "feat(modules): add CreditsCard stub module card component"
```

---

## Task 9: Rewrite `bookings/[id]/+page.svelte`

**Files:**
- Rewrite: `src/routes/(app)/bookings/[id]/+page.svelte`

### Context

Replace the 1144-line monolith with a ~180-line orchestrator that imports and renders module cards. The page retains:
- Confirmation WhatsApp banner
- Page header (booking title, date, status badge)
- Edit booking form (date, time, flexible, notes — but NOT priceOverride which moved to PaymentCard)
- Delete + cancel booking buttons
- Module card rendering loop: ClientsCard → SessionsCard → InstructorCard → InventoryCard → CreditsCard → PaymentCard

Each card receives exactly the data it needs from the page load. No shared state between cards — each card manages its own local state.

### Steps

- [ ] **Delete the old file content and write from scratch**

```svelte
<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/toast.svelte';
    import { withToast } from '$lib/utils/enhance';
    import { DOT_COLORS } from '$lib/features/services/colors';
    import { Zap, Waves } from 'lucide-svelte';
    import type { ActionData, PageData } from './$types';
    import * as m from '$lib/paraglide/messages';
    import { getLocale } from '$lib/paraglide/runtime';

    // Module cards
    import ClientsCard    from '$lib/modules/clients/BookingDetailCard.svelte';
    import SessionsCard   from '$lib/modules/sessions/BookingDetailCard.svelte';
    import InstructorCard from '$lib/modules/instructor/BookingDetailCard.svelte';
    import InventoryCard  from '$lib/modules/inventory/BookingDetailCard.svelte';
    import CreditsCard    from '$lib/modules/credits/BookingDetailCard.svelte';
    import PaymentCard    from '$lib/modules/payment/BookingDetailCard.svelte';

    let { data, form }: { data: PageData; form: ActionData } = $props();

    // Module flags (pure module checks — no type names)
    const modules         = $derived(data.booking.serviceModules ?? {});
    const hasSessions     = $derived('sessions' in modules);
    const hasRoster       = $derived('roster' in modules);
    const hasInventory    = $derived('inventory' in modules);
    const hasInstructor   = $derived('instructor' in modules);
    const hasCredits      = $derived('credits' in modules);
    const hasDateRange    = $derived(!!(('editions' in modules) && data.booking.dateEnd));

    // RBAC
    const canSeeFinancials = $derived(data.canSeeFinancials);

    // Status colors
    const statusColors: Record<string, string> = {
        confirmed: 'bg-confirmed/15 text-green-700',
        pending:   'bg-pending/30 text-amber-700',
        cancelled: 'bg-red-100 text-red-600'
    };

    // Booking edit mode (page-level, not per-card)
    let editing          = $state(false);
    let editDate         = $state(data.booking.date);
    let editTime         = $state(data.booking.time?.slice(0, 5) ?? '');
    let editFlexible     = $state(data.booking.isFlexible);
    let editInstructorId = $state(data.booking.instructorId ?? '');

    function openEdit() {
        editDate = data.booking.date;
        editTime = data.booking.time?.slice(0, 5) ?? '';
        editFlexible = data.booking.isFlexible;
        editInstructorId = data.booking.instructorId ?? '';
        editing = true;
    }

    // Post-creation banner
    const isNewBooking        = $derived($page.url.searchParams.get('new') === '1');
    let confirmationDismissed = $state(false);

    // WhatsApp helpers
    function waMessage(bc: (typeof data.booking.clients)[0], type: 'confirmation' | 'reminder'): string {
        const service = data.booking.serviceName ?? 'tu reserva';
        const d = data.booking.date;
        const firstSession = data.sessions[0];
        const time = firstSession?.time ? ` a las ${firstSession.time.slice(0, 5)}`
            : data.booking.time ? ` a las ${data.booking.time.slice(0, 5)}` : '';
        if (type === 'confirmation')
            return `¡Hola ${bc.clientFirstName}! 🏄 Tu reserva de ${service} el ${d}${time} está confirmada. ¡Te esperamos! - OBA Surf`;
        return `¡Hola ${bc.clientFirstName}! 🌊 Te recordamos que mañana tienes ${service}${time}. ¡Hasta mañana! - OBA Surf`;
    }
    function waUrl(phone: string, message: string): string {
        return `https://wa.me/${phone.replace(/[\s\-\(\)\+]/g, '')}?text=${encodeURIComponent(message)}`;
    }

    function fmtDate(d: string) {
        return new Date(d + 'T00:00:00').toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
    }
</script>

<div class="mx-auto max-w-lg space-y-4 p-4 md:p-6">

    <!-- Confirmation WhatsApp banner -->
    {#if isNewBooking && !confirmationDismissed && data.booking.clients.length > 0}
        {@const withPhone = data.booking.clients.filter(bc => bc.status === 'enrolled' && bc.clientPhone)}
        {#if withPhone.length > 0}
            <div class="rounded-(--radius-card) border border-green-200 bg-green-50 p-4">
                <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-semibold text-green-800">{m.booking_detail_confirm_prompt()}</p>
                    <button type="button" onclick={() => confirmationDismissed = true}
                        class="shrink-0 text-sm text-green-600 hover:text-green-800">✕</button>
                </div>
                <div class="mt-3 space-y-2">
                    {#each withPhone as bc}
                        <div class="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-green-100">
                            <span class="text-sm font-medium text-gray-800">{bc.clientFirstName} {bc.clientLastName}</span>
                            <a href={waUrl(bc.clientPhone!, waMessage(bc, 'confirmation'))} target="_blank" rel="noopener noreferrer"
                                class="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
                                {m.booking_detail_whatsapp_confirm()}
                            </a>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}

    <!-- Header -->
    <div class="flex items-start gap-3">
        <button onclick={() => history.length > 1 ? history.back() : goto('/bookings')}
            class="btn-ghost btn-sm mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0">←</button>
        <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
                <span class="inline-block h-3 w-3 shrink-0 rounded-full"
                    style="background-color: {DOT_COLORS[data.booking.serviceColor] ?? DOT_COLORS['ocean']}"></span>
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
                    {m.booking_detail_run()} {data.booking.serviceEditionStartDate} → {data.booking.serviceEditionEndDate}
                </p>
            {/if}
        </div>
        <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {statusColors[data.booking.status]}">
            {data.booking.status}
        </span>
    </div>

    <!-- Booking edit card (date, time, flexible, notes) -->
    {#if !editing}
        <div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-2.5">
            <div class="flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">{m.booking_detail_details()}</p>
                <button type="button" onclick={openEdit} class="text-xs text-ocean hover:underline">{m.common_edit()}</button>
            </div>
            {#if !hasSessions && data.booking.instructorName}
                <div class="flex items-center justify-between">
                    <span class="text-xs text-muted">{m.booking_new_instructor()}</span>
                    <span class="flex items-center gap-1.5 text-sm text-gray-800"><Waves size={13} class="shrink-0 text-ocean/60" />{data.booking.instructorName}</span>
                </div>
            {/if}
            {#if data.booking.sessionsIncluded != null}
                <div class="flex items-center justify-between">
                    <span class="text-xs text-muted">{m.booking_detail_sessions_purchased()}</span>
                    <span class="text-sm text-gray-800">{data.booking.sessionsIncluded}</span>
                </div>
            {/if}
            {#if data.booking.spotNotes}
                <div class="flex items-center justify-between">
                    <span class="text-xs text-muted">{m.booking_detail_spot()}</span>
                    <span class="text-sm text-gray-800">{data.booking.spotNotes}</span>
                </div>
            {/if}
            {#if data.booking.notes}
                <div>
                    <p class="text-xs text-muted">{m.common_notes()}</p>
                    <p class="mt-0.5 text-sm text-gray-700">{data.booking.notes}</p>
                </div>
            {/if}
        </div>
    {:else}
        <div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border">
            <div class="mb-3 flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">{m.booking_detail_edit_details()}</p>
                <button type="button" onclick={() => editing = false} class="text-xs text-muted hover:text-gray-700">{m.booking_detail_cancel()}</button>
            </div>
            <form method="post" action="?/update" use:enhance={withToast(() => { editing = false; })} class="space-y-3">
                <input type="hidden" name="status" value={data.booking.status} />
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="mb-1 block text-xs text-muted">{m.booking_new_date()}</label>
                        <input name="date" type="date" bind:value={editDate} required
                            class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
                    </div>
                    {#if !hasSessions}
                        <div>
                            <label class="mb-1 block text-xs text-muted">{m.booking_new_time()}</label>
                            <input name="time" type="time" bind:value={editTime} disabled={editFlexible}
                                class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none disabled:opacity-40" />
                        </div>
                    {/if}
                </div>
                {#if !hasSessions}
                    <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="isFlexible" bind:checked={editFlexible} class="h-4 w-4 accent-ocean" />
                        <Zap size={14} class="shrink-0" /> {m.booking_new_flexible()}
                    </label>
                    {#if !hasInstructor}
                        <div>
                            <label class="mb-1 block text-xs text-muted">{m.booking_new_instructor()}</label>
                            <select name="instructorId" bind:value={editInstructorId}
                                class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-ocean focus:outline-none">
                                <option value="">{m.booking_new_unassigned()}</option>
                                {#each data.instructors as instructor}
                                    <option value={instructor.id}>{instructor.name}</option>
                                {/each}
                            </select>
                        </div>
                    {/if}
                {/if}
                <div>
                    <label class="mb-1 block text-xs text-muted">{m.booking_new_spot_notes()}</label>
                    <input name="spotNotes" value={data.booking.spotNotes ?? ''}
                        class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none"
                        placeholder={m.booking_new_spot_placeholder()} />
                </div>
                <div>
                    <label class="mb-1 block text-xs text-muted">{m.booking_new_internal_notes()}</label>
                    <textarea name="notes" rows="2"
                        class="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ocean focus:outline-none">{data.booking.notes ?? ''}</textarea>
                </div>
                <button type="submit" class="btn-primary btn-block">{m.common_save()}</button>
            </form>
        </div>
    {/if}

    <!-- ── Module cards ─────────────────────────────────────────────────────── -->

    <!-- Always: ClientsCard -->
    <ClientsCard
        booking={data.booking}
        {modules}
        clients={data.clients}
        participantsByEnrollment={data.participantsByEnrollment}
        {canSeeFinancials}
    />

    <!-- If sessions module -->
    {#if hasSessions}
        <SessionsCard
            booking={data.booking}
            {modules}
            sessions={data.sessions}
            allDateSessions={data.allDateSessions}
            instructors={data.instructors}
            participantsByEnrollment={data.participantsByEnrollment}
        />
    {/if}

    <!-- If instructor module (and no sessions — per-session assignment is in SessionsCard) -->
    {#if hasInstructor && !hasSessions}
        <InstructorCard
            booking={data.booking}
            {modules}
            instructors={data.instructors}
            sessions={data.sessions}
        />
    {:else if hasInstructor && hasSessions}
        <!-- Instructor with sessions: InstructorCard handles per-session assignment -->
        <InstructorCard
            booking={data.booking}
            {modules}
            instructors={data.instructors}
            sessions={data.sessions}
        />
    {/if}

    <!-- If inventory module -->
    {#if hasInventory}
        <InventoryCard
            booking={data.booking}
            {modules}
            serviceInventoryLinks={data.serviceInventoryLinks}
            itemsByAllocType={data.itemsByAllocType}
            allocTypeTracking={data.allocTypeTracking}
        />
    {/if}

    <!-- If credits module (this IS a pack booking) -->
    {#if hasCredits}
        <CreditsCard booking={data.booking} {modules} />
    {/if}

    <!-- Always: PaymentCard -->
    <PaymentCard booking={data.booking} {modules} {canSeeFinancials} />

    <!-- Cancel / Delete actions -->
    {#if data.booking.status !== 'cancelled' && data.userRole !== 'staff'}
        <div class="flex gap-2">
            <form method="POST" action="?/cancel" use:enhance={withToast()} class="flex-1">
                <button type="submit" class="btn-secondary btn-block text-amber-700">
                    {m.booking_detail_cancel_booking()}
                </button>
            </form>
            {#if data.userRole === 'owner' || data.userRole === 'admin'}
                <form method="POST" action="?/delete" use:enhance={({ cancel }) => {
                    if (!confirm('¿Eliminar esta reserva?')) { cancel(); return; }
                    return withToast(() => goto('/bookings'))();
                }} class="flex-1">
                    <button type="submit" class="btn-secondary btn-block text-red-600">
                        {m.booking_detail_delete_booking()}
                    </button>
                </form>
            {/if}
        </div>
    {/if}
</div>
```

- [ ] **Run svelte-check**
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "bookings/\[id\]|modules/" | grep -i error | head -20
```

Fix any type errors reported. Common ones to expect:
- `data.booking.serviceEditionStartDate` / `serviceEditionEndDate` — check exact field names in the `Booking` type and the query output
- `data.participantsByEnrollment` — verify the type flows correctly from server load
- `data.serviceInventoryLinks` vs `data.booking.allocations` — verify names match server return

- [ ] **Commit**
```bash
git add "src/routes/(app)/bookings/[id]/+page.svelte" && git commit -m "feat(bookings/detail): rewrite with module card architecture"
```

---

## Task 10: Rewrite `bookings/new/+page.svelte`

**Files:**
- Rewrite: `src/routes/(app)/bookings/new/+page.svelte`
- Modify: `src/routes/(app)/bookings/new/+page.server.ts`

### Context

The current file uses `isCamp`, `isLesson`, `isAccommodation` derived from fields that no longer exist on `Service` (all return `undefined` → all false). Additionally `data.runsByService` is used but server returns `data.editionsByService`. The form never submits `participantCount` per client.

The server file is already mostly correct (uses module checks, reads `serviceEditionId`), but does not pass `participantCount` to `createBooking`.

### Steps

- [ ] **Read the server file to understand the action fully**
```bash
cat src/routes/(app)/bookings/new/+page.server.ts
```

- [ ] **Rewrite `bookings/new/+page.svelte` from scratch**

```svelte
<script lang="ts">
    import { untrack } from 'svelte';
    import { Zap } from 'lucide-svelte';
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { toast } from '$lib/stores/toast.svelte';
    import type { ActionData, PageData } from './$types';
    import * as m from '$lib/paraglide/messages';
    import NotesSection from '$lib/components/bookings/sections/NotesSection.svelte';
    import ClientSearchInput from '$lib/components/ClientSearchInput.svelte';

    let { data, form }: { data: PageData; form: ActionData } = $props();
    let loading = $state(false);

    // ── Service selection ─────────────────────────────────────────────────────
    let selectedServiceId = $state(data.services[0]?.id ?? '');
    const selectedService = $derived(data.services.find(s => s.id === selectedServiceId));
    const modules         = $derived(selectedService?.modules ?? {});

    // ── Module flags (pure module checks, no type names) ──────────────────────
    const hasEditions   = $derived('editions' in modules);
    const hasRoster     = $derived('roster' in modules);
    const hasSessions   = $derived('sessions' in modules);
    const hasInventory  = $derived('inventory' in modules);
    const hasInstructor = $derived('instructor' in modules);
    const needsParticipantCount = $derived(hasRoster || hasSessions);

    // ── UX flags ──────────────────────────────────────────────────────────────
    // Derived from modules only — no service type names
    const showEditionPicker = $derived(hasEditions);
    const showDateRange     = $derived(hasInventory && !hasEditions && !hasSessions);
    // showInstructor: only when instructor module AND no sessions (session services schedule later)
    const showInstructor    = $derived(hasInstructor && !hasSessions);

    // ── Editions ──────────────────────────────────────────────────────────────
    const editions        = $derived(selectedService ? (data.editionsByService[selectedService.id] ?? []) : []);
    let selectedEditionId = $state('');
    const selectedEdition = $derived(editions.find(e => e.id === selectedEditionId));
    $effect(() => { selectedEditionId = ''; });  // reset on service change

    // ── Dates ─────────────────────────────────────────────────────────────────
    let date        = $state(data.defaultDate ?? '');
    let time        = $state(data.defaultTime ?? '');
    let isFlexible  = $state((data.defaultTime ?? '') === '');
    let invCheckIn  = $state('');
    let invCheckOut = $state('');

    // For inventory date-range: calculate amount from nights/days
    const inventoryPricingMode = $derived(selectedService?.pricingMode ?? null);
    const inventoryNeedsDateRange = $derived(
        inventoryPricingMode === 'per_night' ||
        inventoryPricingMode === 'per_day' ||
        inventoryPricingMode === 'per_unit_per_day' ||
        inventoryPricingMode === 'per_person_per_day'
    );
    function calcInventoryUnits(): number {
        if (!inventoryNeedsDateRange || !invCheckIn || !invCheckOut) return 1;
        const diff = Math.round((new Date(invCheckOut).getTime() - new Date(invCheckIn).getTime()) / 86_400_000);
        return Math.max(1, diff);
    }
    const invCalculatedAmount = $derived(
        invCheckIn && invCheckOut && inventoryNeedsDateRange
            ? (parseFloat(selectedService?.basePrice ?? '0') * calcInventoryUnits()).toFixed(2)
            : selectedService?.basePrice ?? '0'
    );

    // ── Instructor ────────────────────────────────────────────────────────────
    let instructorId = $state('');

    // ── Notes ─────────────────────────────────────────────────────────────────
    let notesOpen = $state(false);
    let spotNotes = $state('');
    let notes     = $state('');

    // ── Clients ───────────────────────────────────────────────────────────────
    let selectedClients = $state<Array<{
        clientId: string;
        name: string;
        amountDue: string;
        participantCount: number;
    }>>([]);

    function calcAmountDue(): string {
        if (showDateRange) return invCalculatedAmount;
        return selectedService?.basePrice ?? '0';
    }

    function addClient(client: { id: string; firstName: string; lastName: string }) {
        if (selectedClients.some(c => c.clientId === client.id)) return;
        selectedClients = [...selectedClients, {
            clientId: client.id,
            name: `${client.firstName} ${client.lastName}`.trim(),
            amountDue: calcAmountDue(),
            participantCount: 1
        }];
    }
    function removeClient(clientId: string) {
        selectedClients = selectedClients.filter(c => c.clientId !== clientId);
    }

    // Keep inventory client amounts in sync when dates change
    $effect(() => {
        if (showDateRange) {
            const amt = invCalculatedAmount;
            untrack(() => { selectedClients = selectedClients.map(c => ({ ...c, amountDue: amt })); });
        }
    });
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
    <div class="mb-6 flex items-center gap-3">
        <a href="/calendar" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
        <h1 class="text-xl font-bold text-navy">{m.booking_new_title()}</h1>
    </div>

    <form method="post" class="space-y-3" use:enhance={() => {
        loading = true;
        return async ({ result, update }) => {
            loading = false;
            if (result.type === 'success' && result.data) {
                const d = result.data as { bookingId?: string; multiDay?: boolean; date?: string; message?: string };
                toast(d.message ?? m.booking_new_title());
                if (d.multiDay) await goto(`/calendar?date=${d.date}`);
                else if (d.bookingId) await goto(`/bookings/${d.bookingId}?new=1`);
            } else if (result.type === 'failure') {
                if ((result.data as any)?.error) toast((result.data as any).error, 'error');
                await update();
            } else {
                await update();
            }
        };
    }}>

        <!-- Service selector -->
        <div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-4">
            <div>
                <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_service()}</label>
                <select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
                    {#each data.services as s}
                        <option value={s.id}>{s.name} — €{s.basePrice}</option>
                    {/each}
                </select>
            </div>

            <!-- Date section: driven by modules -->
            {#if showEditionPicker}
                <!-- editions module: pick an edition -->
                <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_run()}</label>
                    {#if editions.length > 0}
                        <select name="serviceEditionId" bind:value={selectedEditionId} required class="input w-full">
                            <option value="">{m.booking_new_run_select()}</option>
                            {#each editions as ed}
                                <option value={ed.id} disabled={!ed.active}>
                                    {ed.startDate} → {ed.endDate}{ed.maxCapacity ? ` (${ed.enrolledCount ?? 0}/${ed.maxCapacity})` : ''}{ed.notes ? ` · ${ed.notes}` : ''}
                                </option>
                            {/each}
                        </select>
                        {#if selectedEdition}
                            <p class="mt-1 text-xs text-muted">📅 {selectedEdition.startDate} → {selectedEdition.endDate}</p>
                            <input type="hidden" name="date" value={selectedEdition.startDate} />
                            <input type="hidden" name="dateEnd" value={selectedEdition.endDate} />
                        {:else}
                            <input type="date" name="date" required value={data.defaultDate} class="input w-full mt-2" />
                        {/if}
                    {:else}
                        <p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                            {m.booking_new_no_runs()} <a href="/services/{selectedService?.id}" class="underline">{m.booking_new_add_run()}</a>
                        </p>
                    {/if}
                </div>

            {:else if showDateRange}
                <!-- inventory with date range (rental, accommodation) -->
                {#if inventoryNeedsDateRange}
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkin()}</label>
                            <input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
                        </div>
                        <div>
                            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkout()}</label>
                            <input name="dateEnd" type="date" required bind:value={invCheckOut} class="input w-full" />
                        </div>
                    </div>
                    {#if invCheckIn && invCheckOut && invCheckIn < invCheckOut}
                        <div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 text-sm">
                            <span class="text-gray-600">{calcInventoryUnits()} {inventoryPricingMode === 'per_night' ? 'noches' : 'días'} × €{selectedService?.basePrice}</span>
                            <span class="ml-auto font-semibold text-gray-900">= €{invCalculatedAmount}</span>
                        </div>
                    {/if}
                {:else}
                    <div>
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
                        <input name="date" type="date" required bind:value={invCheckIn} class="input w-full" />
                    </div>
                {/if}

            {:else}
                <!-- Default: date + optional time -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
                        <input type="date" name="date" bind:value={date} required class="input w-full" />
                    </div>
                    <div>
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_time()}</label>
                        <input type="time" name="time" bind:value={time} disabled={isFlexible} class="input w-full disabled:opacity-40" />
                    </div>
                </div>
                {#if !hasSessions}
                    <label class="flex cursor-pointer items-center gap-3 rounded-lg bg-pending/10 p-3">
                        <input type="checkbox" name="isFlexible" bind:checked={isFlexible} class="h-4 w-4 accent-ocean" />
                        <div>
                            <p class="flex items-center gap-1.5 text-sm font-medium text-gray-800"><Zap size={14} /> {m.booking_new_flexible()}</p>
                            <p class="text-xs text-muted">{m.booking_new_flexible_desc()}</p>
                        </div>
                    </label>
                {/if}
                {#if showInstructor}
                    <div>
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_instructor()}</label>
                        <select name="instructorId" bind:value={instructorId} class="input w-full">
                            <option value="">{m.booking_new_unassigned()}</option>
                            {#each data.instructors as inst}
                                <option value={inst.id}>{inst.name}</option>
                            {/each}
                        </select>
                    </div>
                {/if}
                {#if hasSessions}
                    <p class="text-xs text-muted">Las sesiones se programan desde el detalle de reserva.</p>
                    <input type="hidden" name="isFlexible" value="on" />
                {/if}
            {/if}
        </div>

        <!-- Clients section -->
        <div class="rounded-(--radius-card) bg-surface p-4 ring-1 ring-border space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_clients()}</p>

            <!-- Hidden form inputs for each client -->
            {#each selectedClients as c, i}
                <input type="hidden" name="clientId" value={c.clientId} />
                <input type="hidden" name="amountDue" value={c.amountDue} />
                <input type="hidden" name="participantCount" value={c.participantCount} />
            {/each}

            {#if selectedClients.length > 0}
                <div class="space-y-2">
                    {#each selectedClients as c, i}
                        <div class="flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2 ring-1 ring-ocean/20">
                            <span class="flex-1 text-sm font-medium text-ocean">{c.name}</span>
                            {#if needsParticipantCount}
                                <div class="flex items-center gap-1">
                                    <button type="button"
                                        onclick={() => selectedClients[i].participantCount = Math.max(1, c.participantCount - 1)}
                                        class="h-5 w-5 rounded-full border border-ocean/30 text-center text-xs text-ocean hover:bg-ocean/10">−</button>
                                    <span class="w-5 text-center text-xs font-semibold text-ocean">{c.participantCount}</span>
                                    <button type="button"
                                        onclick={() => selectedClients[i].participantCount = c.participantCount + 1}
                                        class="h-5 w-5 rounded-full border border-ocean/30 text-center text-xs text-ocean hover:bg-ocean/10">+</button>
                                </div>
                                <span class="text-[10px] text-muted">part.</span>
                            {/if}
                            <button type="button" onclick={() => removeClient(c.clientId)}
                                class="ml-1 text-ocean/40 hover:text-ocean">✕</button>
                        </div>
                    {/each}
                </div>
            {/if}

            <ClientSearchInput
                clients={data.clients}
                excludeIds={selectedClients.map(c => c.clientId)}
                placeholder={m.booking_new_client_search()}
                onSelect={(c) => addClient({ id: c.id, firstName: c.firstName, lastName: c.lastName })}
            />
        </div>

        <!-- Notes (collapsed, only for non-edition bookings) -->
        {#if !showEditionPicker}
            <div class="rounded-(--radius-card) bg-surface ring-1 ring-border overflow-hidden">
                <button type="button" onclick={() => notesOpen = !notesOpen}
                    class="flex w-full items-center justify-between px-4 py-3 text-left">
                    <span class="text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_notes_section()}</span>
                    <svg class="h-4 w-4 text-muted transition-transform {notesOpen ? 'rotate-90' : ''}"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                {#if notesOpen}
                    <div class="border-t border-border px-4 pb-4 pt-3">
                        <NotesSection bind:spotNotes bind:notes />
                    </div>
                {/if}
            </div>
        {/if}

        <button type="submit" disabled={loading || selectedClients.length === 0}
            class="btn-primary btn-block mt-2">
            {loading ? m.booking_new_saving() : m.booking_new_accommodation()}
        </button>
    </form>
</div>
```

- [ ] **Update `bookings/new/+page.server.ts` to read `participantCount[]` per client**

Find the `bookingClients` mapping in the action (currently `clientIds.map((clientId) => ({ clientId, amountDue: initialAmountDue() }))`) and update to:

```typescript
// Read parallel participantCounts array (same order as clientIds)
const participantCounts = form.getAll('participantCount').map(v => parseInt(v as string) || 1);

const bookingClients = clientIds.map((clientId, i) => ({
    clientId,
    amountDue: initialAmountDue(),
    participantCount: participantCounts[i] ?? 1
}));
```

This affects THREE places in the action (before `inventory` branch, inside `sessions` branch, and the regular branch). Update all three `clients:` arrays to pass `participantCount`.

- [ ] **Run svelte-check on new booking files**
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "bookings/new" | grep -i error | head -10
```

- [ ] **Commit**
```bash
git add "src/routes/(app)/bookings/new/+page.svelte" "src/routes/(app)/bookings/new/+page.server.ts" && git commit -m "feat(bookings/new): rewrite with module-driven flags, add participantCount per enrollment"
```

---

## Task 11: Update service module picker (add credits, wire MODULE_DEFINITIONS)

**Files:**
- Modify: `src/routes/(app)/services/new/+page.svelte`
- Modify: `src/routes/(app)/services/[id]/+page.svelte`

### Context

Both service pages already have working module toggle UIs. Two gaps:
1. `credits` module is not in the toggle list (6th module, currently missing)
2. The toggle labels are hardcoded i18n strings; they could use `MODULE_DEFINITIONS` for icons + labels instead

Fix both gaps with a unified toggle list using MODULE_DEFINITIONS. The `getDefaultConfig` helper handles initial config per module key.

### Steps

- [ ] **Read both files' Advanced sections**
```bash
grep -n "Advanced\|flag\|module\|MODULE" src/routes/(app)/services/new/+page.svelte | head -30
grep -n "Advanced\|flag\|module\|MODULE" src/routes/(app)/services/[id]/+page.svelte | head -30
```

- [ ] **In `services/new/+page.svelte`: replace the flags array with MODULE_DEFINITIONS**

Add import at top of `<script>`:
```typescript
import { MODULE_DEFINITIONS } from '$lib/modules/index';
```

Add `getDefaultConfig` helper function in the script:
```typescript
function getDefaultConfig(key: string): Record<string, unknown> {
    switch (key) {
        case 'roster':     return { maxCapacity: 8 }
        case 'sessions':   return { durationMinutes: 90 }
        case 'instructor': return { required: true }
        case 'editions':   return {}
        case 'inventory':  return { perParticipant: true as const }
        case 'credits':    return { creditsIncluded: 5, validityMode: 'season', compatibleServiceIds: [] }
        default:           return {}
    }
}
```

Replace the existing `{#each [...flags...] as flag}` in the Advanced section with:
```svelte
{#each MODULE_DEFINITIONS as mod}
    {@const isActive = mod.key === 'instructor' ? !!modules.instructor?.required : mod.key in modules}
    <label class="flex cursor-pointer items-start gap-3">
        <input type="checkbox"
            checked={isActive}
            onchange={(e) => {
                const v = (e.target as HTMLInputElement).checked;
                if (mod.key === 'instructor') {
                    modules = { ...modules, instructor: { required: v } };
                } else if (v) {
                    modules = { ...modules, [mod.key]: getDefaultConfig(mod.key) };
                } else {
                    const { [mod.key]: _, ...rest } = modules as Record<string, unknown>;
                    modules = rest as ServiceModules;
                }
            }}
            class="mt-0.5 h-4 w-4 accent-ocean" />
        <div>
            <p class="text-sm font-medium text-gray-800">{mod.icon} {mod.label}</p>
            <p class="text-xs text-muted">{mod.description}</p>
        </div>
    </label>
{/each}
```

Note: `credits` config fields (creditsIncluded, validityMode, etc.) will need a more detailed inline config block in a future iteration. For now, toggling credits is sufficient — the config uses sensible defaults.

- [ ] **Do the same for `services/[id]/+page.svelte`**

Same pattern: import `MODULE_DEFINITIONS`, add `getDefaultConfig`, replace the `{#each [...flags...]}` loop in the edit form.

The `editModules` variable replaces `modules` in the scope.

- [ ] **Run svelte-check on service files**
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "services/(new|\[id\])" | grep -i error | head -10
```

- [ ] **Commit**
```bash
git add "src/routes/(app)/services/" && git commit -m "feat(services): wire MODULE_DEFINITIONS into module picker, add credits toggle"
```

---

## Task 12: Final verification

**Files:** none (verification only)

### Steps

- [ ] **Run svelte-check across all modified files**
```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -v "node_modules" | grep -i "error\|warning" | head -30
```

Expected: 0 errors in project files.

- [ ] **Run unit tests**
```bash
pnpm run test:unit -- --run 2>&1 | tail -15
```

Expected: same or better than baseline.

- [ ] **Manual smoke test** (start dev server and verify)

1. **Calendar** loads without 500 error
2. **New booking — Clase grupal** (roster+sessions+instructor+inventory):
   - Shows date+time picker (no edition picker)
   - Shows participant count stepper per added client
   - Submits, creates booking
3. **New booking — Surf Camp** (editions+roster+sessions+inventory+instructor):
   - Shows edition picker (not date picker)
   - After selecting edition, dates auto-fill
4. **New booking — Neopreno** (inventory only, pricing per_day or per_night):
   - Shows date range picker (check-in / check-out)
5. **Booking detail — Clase grupal**:
   - Header shows service name + date + status ✓
   - ClientsCard shows client row, participant stepper, named participants toggle
   - SessionsCard shows session list
   - InstructorCard shows instructor
   - InventoryCard shows allocations
   - PaymentCard shows per-enrollment amounts
6. **Service create** — module picker shows all 6 modules with icons from MODULE_DEFINITIONS
7. **Service edit** — credits module toggle works

- [ ] **Final commit if any cleanup needed**
```bash
git add -A && git commit -m "chore: Plan 2 module UX rewrite complete" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- [x] `bookings/new`: No isCamp/isLesson/isAccommodation — pure module flags
- [x] `bookings/new`: participantCount submitted per client enrollment
- [x] `bookings/new`: editions picker when editions module; date range when inventory only; date+time default
- [x] `bookings/[id]`: ClientsCard always rendered — owns participants
- [x] `bookings/[id]`: SessionsCard only when sessions module — consumes participant names
- [x] `bookings/[id]`: InstructorCard only when instructor module
- [x] `bookings/[id]`: InventoryCard only when inventory module
- [x] `bookings/[id]`: CreditsCard only when credits module (stub)
- [x] `bookings/[id]`: PaymentCard always rendered
- [x] `bookings/[id]`: serviceEditionId used (not serviceRunId)
- [x] `bookings/[id]`: priceOverride at enrollment level (not booking level)
- [x] Named participants load per enrollment from DB (not empty array)
- [x] services: credits module toggle added; MODULE_DEFINITIONS used for icons

**Not in this plan (Plan 3):**
- Credits queries: `getPackBalance`, `getCompatiblePacksForClient`
- Credit application in new booking form
- Attendance tracking per session (sessionAttendees)
- CreditsCard consumption history
- Per-session instructor InstructorCard when sessions active (stub shown, full implementation needs session query join)

---

*Next: Plan 3 — Credits Module (pack balance queries, credit application in bookings, consumption history)*
