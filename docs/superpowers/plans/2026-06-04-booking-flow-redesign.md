# Booking Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the booking creation form into a unified accordion layout for all service types, add anonymous participant count, add skill level to sessions, and fix ~38 untranslated strings.

**Architecture:** Add two nullable columns to the DB (`bookings.participant_count`, `sessions.skill_level`), extract the new booking form into reusable section components composed by service capability flags, and update the server actions to accept the new fields. The booking detail page receives targeted additions (level badge, participant count display).

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Drizzle ORM, PostgreSQL, Paraglide i18n, Tailwind CSS, Vitest

---

### Task 1: DB schema — add two nullable columns

**Spec ref:** Section 1

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Run: `npm run db:generate` then `npm run db:migrate`

- [ ] **Step 1: Add `participantCount` to `bookings` table in schema**

Open `src/lib/server/db/schema.ts`. In the `bookings` table definition, add after `guestsCount`:

```ts
participantCount: integer('participant_count'),
```

- [ ] **Step 2: Add `skillLevel` to `sessions` table in schema**

In the same file, in the `sessions` table definition, add after `notes`:

```ts
skillLevel: skillLevelEnum('skill_level'),
```

- [ ] **Step 3: Generate and run migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: new migration file created in `drizzle/`, migration applied to local DB.

- [ ] **Step 4: Verify schema test still passes**

```bash
npx vitest run src/lib/server/db/schema.test.ts
```

Expected: all 3 tests PASS (enum values unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat(db): add participant_count to bookings, skill_level to sessions"
```

---

### Task 2: Update TypeScript types

**Spec ref:** Section 1, Section 4 (server action changes)

**Files:**
- Modify: `src/lib/features/bookings/types.ts`
- Modify: `src/lib/features/sessions/types.ts`

- [ ] **Step 1: Add `participantCount` to `Booking` interface**

In `src/lib/features/bookings/types.ts`, in the `Booking` interface, add after `guestsCount`:

```ts
participantCount: number | null;
```

- [ ] **Step 2: Add `participantCount` to `CreateBookingInput`**

In `CreateBookingInput`, add after `guestsCount?`:

```ts
participantCount?: number;
```

- [ ] **Step 3: Add `skillLevel` to `Session` interface**

In `src/lib/features/sessions/types.ts`, in the `Session` interface, add after `notes`:

```ts
skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;
```

- [ ] **Step 4: Add `skillLevel` to `CreateSessionInput` and `UpdateSessionInput`**

In `CreateSessionInput`, add:

```ts
skillLevel?: 'beginner' | 'intermediate' | 'advanced';
```

In `UpdateSessionInput`, add:

```ts
skillLevel?: 'beginner' | 'intermediate' | 'advanced' | null;
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/bookings/types.ts src/lib/features/sessions/types.ts
git commit -m "feat(types): add participantCount and skillLevel fields"
```

---

### Task 3: Update DB queries

**Files:**
- Modify: `src/lib/features/bookings/queries.ts`
- Modify: `src/lib/features/sessions/queries.ts`

- [ ] **Step 1: Update `createBooking` to persist `participantCount`**

In `src/lib/features/bookings/queries.ts`, find `createBooking`. In the `db.insert(bookings).values({...})` call, add:

```ts
participantCount: input.participantCount ?? null,
```

- [ ] **Step 2: Update `getBooking` to select `participantCount`**

In `getBooking` query, locate where `bookings` columns are selected. Verify `participantCount` is included (if using `select()` without specifying columns it's automatic; if explicit, add it). The query uses `db.select().from(bookings)` style — Drizzle returns all columns by default, so no change needed unless columns are explicitly enumerated.

Check: `grep -n "participantCount\|select(" src/lib/features/bookings/queries.ts | head -20`

If explicit column selection exists, add `participantCount: bookings.participantCount`.

- [ ] **Step 3: Update `createSession` to persist `skillLevel`**

In `src/lib/features/sessions/queries.ts`, find `createSession`. In the insert values, add:

```ts
skillLevel: input.skillLevel ?? null,
```

- [ ] **Step 4: Update `updateSession` to persist `skillLevel`**

In `updateSession`, find the update values object. Add:

```ts
...(input.skillLevel !== undefined && { skillLevel: input.skillLevel }),
```

- [ ] **Step 5: Verify `listSessionsForBooking` returns `skillLevel`**

Check: `grep -n "select\|skillLevel" src/lib/features/sessions/queries.ts | head -20`

If `listSessionsForBooking` does an explicit column select, add `skillLevel: sessions.skillLevel`. If it selects all columns, no change needed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/bookings/queries.ts src/lib/features/sessions/queries.ts
git commit -m "feat(queries): persist participantCount and skillLevel"
```

---

### Task 4: Add i18n keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add new keys to `messages/en.json`**

Add these entries (maintain alphabetical order within booking_new / booking_detail / skill_level groups):

```json
"booking_new_participant_count": "Number of participants",
"booking_new_participant_mode_count": "Just a count",
"booking_new_participant_mode_names": "Add names",
"booking_new_session_n": "Session {n}",
"booking_new_session_of": "of {total}",
"booking_new_session_not_scheduled": "Not scheduled",
"booking_new_notes_section": "Notes",
"booking_new_level": "Level",
"booking_new_saving": "Saving…",
"booking_new_additional_days": "Additional days",
"booking_new_no_unit_types": "No unit types configured for this property. Add them in the service settings first.",
"skill_level_beginner": "Beginner",
"skill_level_intermediate": "Intermediate",
"skill_level_advanced": "Advanced",
"booking_detail_session_level": "Level",
"booking_detail_session_generate": "Generate",
"booking_detail_session_add": "+ Add",
"booking_detail_session_save": "Save session",
"booking_detail_session_edit": "Edit",
"booking_detail_session_unscheduled": "Unscheduled",
"booking_detail_session_attending": "Attending",
"booking_detail_session_new": "New session",
"booking_detail_session_date": "Date *",
"booking_detail_session_time": "Time",
"booking_detail_session_duration": "Duration (min)",
"booking_detail_session_notes": "Notes / spot",
"booking_detail_session_instructors": "Instructors",
"booking_detail_session_cancel_confirm": "Cancel this session?",
"booking_detail_session_defaults_to_client": "Defaults to booking client",
"booking_detail_generate_sessions": "Generate sessions",
"booking_detail_generate_for": "Generate for {start} → {end}",
"booking_detail_sessions_per_day": "Sessions / day",
"booking_detail_sessions_times": "Times",
"booking_detail_weekdays_only": "Weekdays only",
"booking_detail_clear_existing": "Clear existing sessions first",
"booking_detail_no_sessions": "No sessions yet — use Generate or + Add.",
"booking_detail_needs_time": "Needs a time assigned",
"booking_detail_cancelled_label": "Cancelled",
"booking_detail_save_payment": "Save",
"booking_detail_participant_count": "{count} participants"
```

- [ ] **Step 2: Add same keys to `messages/es.json`**

```json
"booking_new_participant_count": "Número de participantes",
"booking_new_participant_mode_count": "Solo cantidad",
"booking_new_participant_mode_names": "Añadir nombres",
"booking_new_session_n": "Sesión {n}",
"booking_new_session_of": "de {total}",
"booking_new_session_not_scheduled": "Sin programar",
"booking_new_notes_section": "Notas",
"booking_new_level": "Nivel",
"booking_new_saving": "Guardando…",
"booking_new_additional_days": "Días adicionales",
"booking_new_no_unit_types": "No hay tipos de unidad configurados. Añádelos en los ajustes del servicio.",
"skill_level_beginner": "Principiante",
"skill_level_intermediate": "Intermedio",
"skill_level_advanced": "Avanzado",
"booking_detail_session_level": "Nivel",
"booking_detail_session_generate": "Generar",
"booking_detail_session_add": "+ Añadir",
"booking_detail_session_save": "Guardar sesión",
"booking_detail_session_edit": "Editar",
"booking_detail_session_unscheduled": "Sin programar",
"booking_detail_session_attending": "Asistentes",
"booking_detail_session_new": "Nueva sesión",
"booking_detail_session_date": "Fecha *",
"booking_detail_session_time": "Hora",
"booking_detail_session_duration": "Duración (min)",
"booking_detail_session_notes": "Notas / spot",
"booking_detail_session_instructors": "Instructores",
"booking_detail_session_cancel_confirm": "¿Cancelar esta sesión?",
"booking_detail_session_defaults_to_client": "Por defecto el cliente de la reserva",
"booking_detail_generate_sessions": "Generar sesiones",
"booking_detail_generate_for": "Generar para {start} → {end}",
"booking_detail_sessions_per_day": "Sesiones / día",
"booking_detail_sessions_times": "Horas",
"booking_detail_weekdays_only": "Solo días laborables",
"booking_detail_clear_existing": "Eliminar sesiones existentes primero",
"booking_detail_no_sessions": "Sin sesiones — usa Generar o + Añadir.",
"booking_detail_needs_time": "Necesita hora asignada",
"booking_detail_cancelled_label": "Cancelado",
"booking_detail_save_payment": "Guardar",
"booking_detail_participant_count": "{count} participantes"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(i18n): add keys for participant count, skill level, session management"
```

---

### Task 5: Create `FormSection.svelte` component

**Files:**
- Create: `src/lib/components/bookings/FormSection.svelte`

This is a reusable accordion shell. It accepts a title, optional badge text, badge variant, and open state. Clicking the header toggles open/closed.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		badge = '',
		badgeVariant = 'neutral',
		open = $bindable(false),
		children
	}: {
		title: string;
		badge?: string;
		badgeVariant?: 'done' | 'progress' | 'neutral';
		open?: boolean;
		children: Snippet;
	} = $props();

	const badgeClass = $derived(
		badgeVariant === 'done'
			? 'bg-green-100 text-green-700'
			: badgeVariant === 'progress'
				? 'bg-blue-100 text-blue-700'
				: 'bg-gray-100 text-gray-500'
	);
</script>

<div class="overflow-hidden rounded-(--radius-card) ring-1 {open ? 'ring-ocean/60' : 'ring-border'}">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between bg-surface px-4 py-3 text-left"
	>
		<span class="text-sm font-semibold text-navy">{title}</span>
		<div class="flex items-center gap-2">
			{#if badge}
				<span class="rounded-full px-2 py-0.5 text-xs font-medium {badgeClass}">{badge}</span>
			{/if}
			<svg
				class="h-4 w-4 text-muted transition-transform {open ? 'rotate-90' : ''}"
				fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</div>
	</button>
	{#if open}
		<div class="border-t border-border bg-white px-4 py-4">
			{@render children()}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/bookings/FormSection.svelte
git commit -m "feat(ui): add FormSection accordion component"
```

---

### Task 6: Create `SessionSection.svelte`

**Files:**
- Create: `src/lib/components/bookings/sections/SessionSection.svelte`

Renders one session's fields: date, time, flexible toggle, level selector, instructor. Used for each session 1..N inside the new booking form.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import { Zap } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	let {
		index,
		total,
		instructors,
		date = $bindable(''),
		time = $bindable(''),
		isFlexible = $bindable(false),
		skillLevel = $bindable<'beginner' | 'intermediate' | 'advanced' | ''>(''),
		instructorIds = $bindable<string[]>([])
	}: {
		index: number;
		total: number;
		instructors: Array<{ id: string; name: string }>;
		date?: string;
		time?: string;
		isFlexible?: boolean;
		skillLevel?: 'beginner' | 'intermediate' | 'advanced' | '';
		instructorIds?: string[];
	} = $props();

	const levels = [
		{ value: 'beginner', label: () => m.skill_level_beginner() },
		{ value: 'intermediate', label: () => m.skill_level_intermediate() },
		{ value: 'advanced', label: () => m.skill_level_advanced() }
	] as const;

	function toggleInstructor(id: string) {
		instructorIds = instructorIds.includes(id)
			? instructorIds.filter((x) => x !== id)
			: [...instructorIds, id];
	}
</script>

<div class="space-y-3">
	<!-- Hidden fields for form submission -->
	<input type="hidden" name="sessionIndex" value={index} />

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_detail_session_date()}
			</label>
			<input
				type="date"
				name="sessionDate[{index}]"
				bind:value={date}
				required
				class="input w-full"
			/>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_detail_session_time()}
			</label>
			<div class="flex items-center gap-2">
				<input
					type="time"
					name="sessionTime[{index}]"
					bind:value={time}
					disabled={isFlexible}
					class="input flex-1 disabled:opacity-40"
				/>
				<button
					type="button"
					onclick={() => (isFlexible = !isFlexible)}
					title={m.booking_new_flexible()}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border {isFlexible ? 'border-ocean bg-ocean/10 text-ocean' : 'border-border text-muted'}"
				>
					<Zap class="h-4 w-4" />
				</button>
			</div>
			<input type="hidden" name="sessionFlexible[{index}]" value={isFlexible ? 'on' : ''} />
		</div>
	</div>

	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_level()} <span class="font-normal normal-case text-muted">(optional)</span>
		</label>
		<div class="flex gap-2">
			{#each levels as lvl}
				<button
					type="button"
					onclick={() => (skillLevel = skillLevel === lvl.value ? '' : lvl.value)}
					class="flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors
						{skillLevel === lvl.value
						? 'border-ocean bg-ocean/10 text-ocean'
						: 'border-border text-muted hover:border-ocean/40'}"
				>
					{lvl.label()}
				</button>
			{/each}
		</div>
		<input type="hidden" name="sessionLevel[{index}]" value={skillLevel} />
	</div>

	{#if instructors.length > 0}
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_new_instructor()}
			</label>
			<div class="flex flex-wrap gap-2">
				{#each instructors as inst}
					<label class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs
						{instructorIds.includes(inst.id) ? 'border-ocean bg-ocean/10 text-ocean' : 'border-border text-gray-600'}">
						<input
							type="checkbox"
							name="sessionInstructor[{index}][]"
							value={inst.id}
							checked={instructorIds.includes(inst.id)}
							onchange={() => toggleInstructor(inst.id)}
							class="sr-only"
						/>
						{inst.name}
					</label>
				{/each}
			</div>
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/bookings/sections/SessionSection.svelte
git commit -m "feat(ui): add SessionSection component with level selector"
```

---

### Task 7: Create `BookingBasics.svelte`

**Files:**
- Create: `src/lib/components/bookings/sections/BookingBasics.svelte`

Holds service selector, sessions-included count, participant count/names toggle, and for lesson mode the client (payer). Props are bindable to parent page state.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	type Service = {
		id: string;
		name: string;
		basePrice: string;
		hasSessions: boolean;
		hasRoster: boolean;
		hasDateRange: boolean;
		hasInventoryUnits: boolean;
		requiresInstructor: boolean;
		defaultSessionsIncluded: number | null;
	};
	type Client = { id: string; firstName: string; lastName: string; phone: string | null };

	let {
		services,
		clients,
		selectedServiceId = $bindable(''),
		sessionsIncluded = $bindable(1),
		participantMode = $bindable<'count' | 'names'>('count'),
		participantCount = $bindable(1),
		participantNames = $bindable<string[]>([]),
		selectedClients = $bindable<Array<{ clientId: string; name: string; amountDue: string }>>([]),
		clientSearch = $bindable('')
	}: {
		services: Service[];
		clients: Client[];
		selectedServiceId?: string;
		sessionsIncluded?: number;
		participantMode?: 'count' | 'names';
		participantCount?: number;
		participantNames?: string[];
		selectedClients?: Array<{ clientId: string; name: string; amountDue: string }>;
		clientSearch?: string;
	} = $props();

	const selectedService = $derived(services.find((s) => s.id === selectedServiceId));
	const isLesson = $derived(!!(selectedService?.hasSessions && !selectedService?.hasRoster));

	const filteredClients = $derived(
		clientSearch.length > 1
			? clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) &&
						!selectedClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);

	function addClient(client: Client) {
		const price = selectedService?.basePrice ?? '0';
		selectedClients = [
			...selectedClients,
			{ clientId: client.id, name: `${client.firstName} ${client.lastName}`, amountDue: price }
		];
		clientSearch = '';
	}

	function removeClient(clientId: string) {
		selectedClients = selectedClients.filter((c) => c.clientId !== clientId);
	}

	function addParticipantField() {
		participantNames = [...participantNames, ''];
	}

	function removeParticipantField(i: number) {
		participantNames = participantNames.filter((_, idx) => idx !== i);
	}

	$effect(() => {
		if (selectedService?.defaultSessionsIncluded) {
			sessionsIncluded = selectedService.defaultSessionsIncluded;
		}
	});
</script>

<div class="space-y-4">
	<!-- Service -->
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_service()}
		</label>
		<select name="serviceId" bind:value={selectedServiceId} required class="input w-full">
			{#each services as s}
				<option value={s.id}>{s.name} — €{s.basePrice}</option>
			{/each}
		</select>
	</div>

	<!-- Sessions included (lesson only) -->
	{#if isLesson}
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_new_sessions_included()}
			</label>
			<input
				type="number"
				name="sessionsIncluded"
				bind:value={sessionsIncluded}
				min="1"
				max="20"
				required
				class="input w-full"
			/>
		</div>

		<!-- Participants -->
		<div>
			<div class="mb-2 flex items-center justify-between">
				<label class="text-xs font-semibold uppercase tracking-wide text-muted">
					{m.booking_new_participants()} <span class="font-normal normal-case">(optional)</span>
				</label>
				<div class="flex gap-1">
					<button
						type="button"
						onclick={() => (participantMode = 'count')}
						class="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors
							{participantMode === 'count' ? 'bg-ocean/10 text-ocean' : 'bg-gray-100 text-muted'}"
					>
						{m.booking_new_participant_mode_count()}
					</button>
					<button
						type="button"
						onclick={() => (participantMode = 'names')}
						class="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors
							{participantMode === 'names' ? 'bg-ocean/10 text-ocean' : 'bg-gray-100 text-muted'}"
					>
						{m.booking_new_participant_mode_names()}
					</button>
				</div>
			</div>

			{#if participantMode === 'count'}
				<input
					type="number"
					name="participantCount"
					bind:value={participantCount}
					min="1"
					class="input w-full"
					placeholder={m.booking_new_participant_count()}
				/>
			{:else}
				{#each participantNames as _, i}
					<div class="mb-2 flex gap-2">
						<input
							type="text"
							name="participantName"
							bind:value={participantNames[i]}
							placeholder={m.booking_new_participant_placeholder()}
							class="input flex-1"
						/>
						<button
							type="button"
							onclick={() => removeParticipantField(i)}
							class="text-muted hover:text-red-500"
						>✕</button>
					</div>
				{/each}
				<button
					type="button"
					onclick={addParticipantField}
					class="text-sm text-ocean hover:underline"
				>
					{m.booking_new_add_participant()}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Client (payer) — shown for lesson mode here, other types use ClientsSection -->
	{#if isLesson}
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_new_clients()}
			</label>
			<div class="relative">
				<input
					type="text"
					bind:value={clientSearch}
					placeholder={m.booking_new_client_search()}
					autocomplete="off"
					class="input w-full"
				/>
				{#if filteredClients.length > 0}
					<ul class="absolute z-10 mt-1 w-full rounded-(--radius-card) border border-border bg-white shadow-lg">
						{#each filteredClients as c}
							<li>
								<button
									type="button"
									onclick={() => addClient(c)}
									class="w-full px-3 py-2 text-left text-sm hover:bg-ocean/5"
								>
									{c.firstName} {c.lastName}
									{#if c.phone}<span class="text-muted"> · {c.phone}</span>{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#each selectedClients as sc, i}
				<div class="mt-2 flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
					<span>{sc.name}</span>
					<div class="flex items-center gap-2">
						<span class="text-muted">€</span>
						<input
							type="number"
							name="amountDue"
							bind:value={selectedClients[i].amountDue}
							step="0.01"
							min="0"
							class="w-20 rounded border border-border px-1 py-0.5 text-right text-sm"
						/>
						<input type="hidden" name="clientId" value={sc.clientId} />
						<button type="button" onclick={() => removeClient(sc.clientId)} class="text-muted hover:text-red-500">✕</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/bookings/sections/BookingBasics.svelte
git commit -m "feat(ui): add BookingBasics section component"
```

---

### Task 8: Create `NotesSection.svelte`

**Files:**
- Create: `src/lib/components/bookings/sections/NotesSection.svelte`

Simple section for spot notes + internal notes.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let {
		spotNotes = $bindable(''),
		notes = $bindable('')
	}: {
		spotNotes?: string;
		notes?: string;
	} = $props();
</script>

<div class="space-y-3">
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_spot_notes()}
		</label>
		<input
			type="text"
			name="spotNotes"
			bind:value={spotNotes}
			placeholder="e.g. Playa Norte, board locker #3"
			class="input w-full"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_notes()}
		</label>
		<textarea
			name="notes"
			bind:value={notes}
			rows="2"
			class="input w-full resize-none"
		></textarea>
	</div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/bookings/sections/NotesSection.svelte
git commit -m "feat(ui): add NotesSection component"
```

---

### Task 9: Rework `bookings/new/+page.svelte`

**Files:**
- Modify: `src/routes/(app)/bookings/new/+page.svelte`

Replace the monolithic form with the accordion section components. This task is a full rewrite of the page. Preserve all existing functionality for accommodation, camp, and regular service flows.

- [ ] **Step 1: Rewrite the page**

Replace the full content of `src/routes/(app)/bookings/new/+page.svelte` with:

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { Tent } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ActionData, PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import FormSection from '$lib/components/bookings/FormSection.svelte';
	import BookingBasics from '$lib/components/bookings/sections/BookingBasics.svelte';
	import SessionSection from '$lib/components/bookings/sections/SessionSection.svelte';
	import NotesSection from '$lib/components/bookings/sections/NotesSection.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);

	// ── Service selection ──────────────────────────────────────────────────────
	let selectedServiceId = $state(data.services[0]?.id ?? '');
	const selectedService = $derived(data.services.find((s) => s.id === selectedServiceId));
	const isCamp = $derived(!!(selectedService?.hasRoster && selectedService?.hasDateRange));
	const isLesson = $derived(!!(selectedService?.hasSessions && !isCamp));
	const isAccommodation = $derived(!!selectedService?.hasInventoryUnits);
	const runs = $derived(selectedService ? (data.runsByService[selectedService.id] ?? []) : []);

	// ── Booking basics state ───────────────────────────────────────────────────
	let sessionsIncluded = $state(untrack(() => selectedService?.defaultSessionsIncluded ?? 1));
	let participantMode = $state<'count' | 'names'>('count');
	let participantCount = $state(1);
	let participantNames = $state<string[]>([]);
	let selectedClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let clientSearch = $state('');

	// ── Session states (one per session index) ────────────────────────────────
	let sessionDates = $state<string[]>([data.defaultDate ?? '']);
	let sessionTimes = $state<string[]>([data.defaultTime ?? '']);
	let sessionFlexibles = $state<boolean[]>([untrack(() => data.defaultTime === '')]);
	let sessionLevels = $state<Array<'beginner' | 'intermediate' | 'advanced' | ''>>(['']);
	let sessionInstructorIds = $state<string[][]>([[]]);
	let sessionOpen = $state<boolean[]>([true]);

	// Keep session arrays in sync with sessionsIncluded
	$effect(() => {
		const n = sessionsIncluded;
		sessionDates = Array.from({ length: n }, (_, i) => sessionDates[i] ?? (i === 0 ? data.defaultDate ?? '' : ''));
		sessionTimes = Array.from({ length: n }, (_, i) => sessionTimes[i] ?? '');
		sessionFlexibles = Array.from({ length: n }, (_, i) => sessionFlexibles[i] ?? false);
		sessionLevels = Array.from({ length: n }, (_, i) => sessionLevels[i] ?? sessionLevels[0] ?? '');
		sessionInstructorIds = Array.from({ length: n }, (_, i) => sessionInstructorIds[i] ?? []);
		sessionOpen = Array.from({ length: n }, (_, i) => sessionOpen[i] ?? false);
		sessionOpen[0] = true; // session 1 always open
	});

	// ── Accordion open states ─────────────────────────────────────────────────
	let basicsOpen = $state(true);
	let notesOpen = $state(false);

	// ── Accommodation state ────────────────────────────────────────────────────
	let selectedUnitTypeId = $state('');
	let guestsCount = $state(1);
	let checkIn = $state(data.defaultDate ?? '');
	let checkOut = $state('');
	const unitTypes = $derived(isAccommodation ? (data.unitTypesByService[selectedServiceId] ?? []) : []);
	const selectedUnitType = $derived(unitTypes.find((ut) => ut.id === selectedUnitTypeId));
	$effect(() => {
		if (isAccommodation && unitTypes.length > 0 && !selectedUnitTypeId) {
			selectedUnitTypeId = unitTypes[0].id;
		}
		if (!isAccommodation) selectedUnitTypeId = '';
	});

	// ── Camp state ─────────────────────────────────────────────────────────────
	let selectedRunId = $state('');
	const selectedRun = $derived(runs.find((r) => r.id === selectedRunId));

	// ── Regular service state ──────────────────────────────────────────────────
	let regularDate = $state(data.defaultDate ?? '');
	let regularTime = $state(data.defaultTime ?? '');
	let isFlexibleRegular = $state(untrack(() => data.defaultTime === ''));
	let instructorId = $state('');
	let extraDays = $state<Array<{ date: string; time: string }>>([]);
	let spotNotes = $state('');
	let notes = $state('');

	// ── Accommodation clients (separate from lesson clients) ───────────────────
	let accomClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let accomSearch = $state('');
	const filteredAccomClients = $derived(
		accomSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(accomSearch.toLowerCase()) &&
						!accomClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);
	function addAccomClient(c: (typeof data.clients)[0]) {
		const price = selectedUnitType?.pricePerNight ?? selectedService?.basePrice ?? '0';
		accomClients = [...accomClients, { clientId: c.id, name: `${c.firstName} ${c.lastName}`, amountDue: price }];
		accomSearch = '';
	}

	// ── Camp clients ───────────────────────────────────────────────────────────
	let campClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let campSearch = $state('');
	const filteredCampClients = $derived(
		campSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(campSearch.toLowerCase()) &&
						!campClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);
	function addCampClient(c: (typeof data.clients)[0]) {
		campClients = [...campClients, { clientId: c.id, name: `${c.firstName} ${c.lastName}`, amountDue: selectedService?.basePrice ?? '0' }];
		campSearch = '';
	}

	// ── Regular service clients ────────────────────────────────────────────────
	let regularClients = $state<Array<{ clientId: string; name: string; amountDue: string }>>([]);
	let regularSearch = $state('');
	const filteredRegularClients = $derived(
		regularSearch.length > 1
			? data.clients.filter(
					(c) =>
						`${c.firstName} ${c.lastName}`.toLowerCase().includes(regularSearch.toLowerCase()) &&
						!regularClients.some((sc) => sc.clientId === c.id)
				)
			: []
	);
	function addRegularClient(c: (typeof data.clients)[0]) {
		regularClients = [...regularClients, { clientId: c.id, name: `${c.firstName} ${c.lastName}`, amountDue: selectedService?.basePrice ?? '0' }];
		regularSearch = '';
	}

	// ── New client inline creation ─────────────────────────────────────────────
	let creatingClient = $state(false);
	let newClientFirst = $state('');
	let newClientLast = $state('');
	let newClientPhone = $state('');
	let newClientEmail = $state('');
	let newClientLoading = $state(false);

	async function createAndAddClient(addFn: (c: { id: string; firstName: string; lastName: string; phone: string | null }) => void) {
		if (!newClientFirst.trim()) return;
		newClientLoading = true;
		const fd = new FormData();
		fd.set('firstName', newClientFirst.trim());
		fd.set('lastName', newClientLast.trim());
		fd.set('phone', newClientPhone.trim());
		fd.set('email', newClientEmail.trim());
		const res = await fetch('/api/v1/clients', { method: 'POST', body: fd });
		if (res.ok) {
			const created = await res.json();
			addFn(created);
		}
		newClientFirst = newClientLast = newClientPhone = newClientEmail = '';
		creatingClient = false;
		newClientLoading = false;
	}

	// ── Session badge helper ───────────────────────────────────────────────────
	function sessionBadge(i: number): string {
		if (sessionTimes[i] && !sessionFlexibles[i]) return sessionTimes[i].slice(0, 5);
		if (sessionFlexibles[i]) return '⚡';
		return m.booking_new_session_not_scheduled();
	}
	function sessionBadgeVariant(i: number): 'done' | 'progress' | 'neutral' {
		return sessionTimes[i] && !sessionFlexibles[i] ? 'done' : 'neutral';
	}
</script>

<div class="p-4 md:p-6">
	<div class="mb-4 flex items-center gap-3">
		<a href="/bookings" class="text-sm text-muted hover:text-navy">← {m.nav_bookings()}</a>
	</div>
	<h1 class="mb-6 text-xl font-bold text-navy">{m.booking_new_title()}</h1>

	{#if form?.error}
		<div class="mb-4 rounded-(--radius-card) bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ result, update }) => {
				loading = false;
				if (result.type === 'success' && result.data?.bookingId) {
					toast.success(result.data.message ?? m.booking_new_title());
					goto(`/bookings/${result.data.bookingId}?new=1`);
				} else if (result.type === 'success' && result.data?.multiDay) {
					toast.success(result.data.message ?? m.booking_new_title());
					goto(`/bookings?date=${result.data.date}`);
				} else {
					await update();
				}
			};
		}}
	>
		<div class="space-y-3">
			<!-- ── Booking basics ───────────────────────────────────────────── -->
			<FormSection title={m.booking_new_service()} open={basicsOpen} badgeVariant="progress">
				<BookingBasics
					services={data.services}
					clients={data.clients}
					bind:selectedServiceId
					bind:sessionsIncluded
					bind:participantMode
					bind:participantCount
					bind:participantNames
					bind:selectedClients
					bind:clientSearch
				/>
			</FormSection>

			<!-- ── Lesson: session sections ──────────────────────────────────── -->
			{#if isLesson}
				{#each Array.from({ length: sessionsIncluded }, (_, i) => i) as i (i)}
					<FormSection
						title="{m.booking_new_session_n({ n: i + 1 })} {m.booking_new_session_of({ total: sessionsIncluded })}"
						badge={sessionBadge(i)}
						badgeVariant={sessionBadgeVariant(i)}
						bind:open={sessionOpen[i]}
					>
						<SessionSection
							index={i}
							total={sessionsIncluded}
							instructors={data.instructors}
							bind:date={sessionDates[i]}
							bind:time={sessionTimes[i]}
							bind:isFlexible={sessionFlexibles[i]}
							bind:skillLevel={sessionLevels[i]}
							bind:instructorIds={sessionInstructorIds[i]}
						/>
					</FormSection>
				{/each}
			{/if}

			<!-- ── Accommodation ─────────────────────────────────────────────── -->
			{#if isAccommodation}
				<FormSection title={m.booking_new_unit_type()} open={true} badgeVariant="progress">
					{#if unitTypes.length === 0}
						<p class="text-sm text-muted">{m.booking_new_no_unit_types()}</p>
					{:else}
						<div class="space-y-3">
							<div class="space-y-2">
								{#each unitTypes as ut}
									<label class="flex cursor-pointer items-start gap-3 rounded-md border p-3 {selectedUnitTypeId === ut.id ? 'border-ocean bg-ocean/5' : 'border-border'}">
										<input type="radio" name="accommodationUnitTypeId" value={ut.id} bind:group={selectedUnitTypeId} class="mt-0.5" />
										<div>
											<p class="text-sm font-medium">{ut.name}</p>
											<p class="text-xs text-muted">€{ut.pricePerNight}/night · max {ut.maxOccupancy}</p>
										</div>
									</label>
								{/each}
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkin()}</label>
									<input type="date" name="date" bind:value={checkIn} required class="input w-full" />
								</div>
								<div>
									<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_checkout()}</label>
									<input type="date" name="dateEnd" bind:value={checkOut} required class="input w-full" />
								</div>
							</div>
							<div>
								<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_guests()}</label>
								<input type="number" name="guestsCount" bind:value={guestsCount} min="1" max={selectedUnitType?.maxOccupancy ?? 20} class="input w-full" />
							</div>
						</div>
					{/if}
				</FormSection>
				<FormSection title={m.booking_new_guests_clients()} open={true} badgeVariant="progress">
					<div class="space-y-2">
						<div class="relative">
							<input type="text" bind:value={accomSearch} placeholder={m.booking_new_client_search()} autocomplete="off" class="input w-full" />
							{#if filteredAccomClients.length > 0}
								<ul class="absolute z-10 mt-1 w-full rounded-(--radius-card) border border-border bg-white shadow-lg">
									{#each filteredAccomClients as c}
										<li><button type="button" onclick={() => addAccomClient(c)} class="w-full px-3 py-2 text-left text-sm hover:bg-ocean/5">{c.firstName} {c.lastName}{#if c.phone} · {c.phone}{/if}</button></li>
									{/each}
								</ul>
							{/if}
						</div>
						{#each accomClients as sc, i}
							<div class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
								<span>{sc.name}</span>
								<div class="flex items-center gap-2">
									<span class="text-muted">€</span>
									<input type="number" name="amountDue" bind:value={accomClients[i].amountDue} step="0.01" min="0" class="w-20 rounded border border-border px-1 py-0.5 text-right text-sm" />
									<input type="hidden" name="clientId" value={sc.clientId} />
									<button type="button" onclick={() => { accomClients = accomClients.filter(c => c.clientId !== sc.clientId); }} class="text-muted hover:text-red-500">✕</button>
								</div>
							</div>
						{/each}
					</div>
				</FormSection>
			{/if}

			<!-- ── Camp ────────────────────────────────────────────────────────── -->
			{#if isCamp}
				<FormSection title={m.booking_new_run()} open={true} badgeVariant="progress">
					<div class="space-y-3">
						{#if runs.length === 0}
							<p class="text-sm text-muted">{m.booking_new_no_runs()} <a href="/services/{selectedServiceId}" class="text-ocean underline">{m.booking_new_add_run()}</a></p>
						{:else}
							<select name="serviceRunId" bind:value={selectedRunId} required class="input w-full">
								<option value="">{m.booking_new_run_select()}</option>
								{#each runs as run}
									<option value={run.id}>
										{run.startDate} → {run.endDate}
										{#if run.notes} · {run.notes}{/if}
										{#if run.maxCapacity} ({run.maxCapacity} max){/if}
									</option>
								{/each}
							</select>
							{#if selectedRun}
								<div>
									<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
									<input type="date" name="date" value={selectedRun.startDate} readonly class="input w-full bg-gray-50" />
									<input type="hidden" name="dateEnd" value={selectedRun.endDate} />
								</div>
							{/if}
						{/if}
					</div>
				</FormSection>
				<FormSection title={m.booking_new_clients()} open={true} badgeVariant="progress">
					<div class="space-y-2">
						<div class="relative">
							<input type="text" bind:value={campSearch} placeholder={m.booking_new_client_search()} autocomplete="off" class="input w-full" />
							{#if filteredCampClients.length > 0}
								<ul class="absolute z-10 mt-1 w-full rounded-(--radius-card) border border-border bg-white shadow-lg">
									{#each filteredCampClients as c}
										<li><button type="button" onclick={() => addCampClient(c)} class="w-full px-3 py-2 text-left text-sm hover:bg-ocean/5">{c.firstName} {c.lastName}{#if c.phone} · {c.phone}{/if}</button></li>
									{/each}
								</ul>
							{/if}
						</div>
						{#each campClients as sc, i}
							<div class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
								<span>{sc.name}</span>
								<div class="flex items-center gap-2">
									<span class="text-muted">€</span>
									<input type="number" name="amountDue" bind:value={campClients[i].amountDue} step="0.01" min="0" class="w-20 rounded border border-border px-1 py-0.5 text-right text-sm" />
									<input type="hidden" name="clientId" value={sc.clientId} />
									<button type="button" onclick={() => { campClients = campClients.filter(c => c.clientId !== sc.clientId); }} class="text-muted hover:text-red-500">✕</button>
								</div>
							</div>
						{/each}
					</div>
				</FormSection>
			{/if}

			<!-- ── Regular service ───────────────────────────────────────────── -->
			{#if !isLesson && !isAccommodation && !isCamp && selectedService}
				<FormSection title={m.booking_new_date()} open={true} badgeVariant="progress">
					<div class="space-y-3">
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_date()}</label>
								<input type="date" name="date" bind:value={regularDate} required class="input w-full" />
							</div>
							<div>
								<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{m.booking_new_time()}</label>
								<input type="time" name="time" bind:value={regularTime} disabled={isFlexibleRegular} class="input w-full disabled:opacity-40" />
							</div>
						</div>
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="isFlexible" bind:checked={isFlexibleRegular} />
							{m.booking_new_flexible()} — {m.booking_new_flexible_desc()}
						</label>
						{#if selectedService.requiresInstructor && !selectedService.hasSessions}
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
					</div>
				</FormSection>
				<FormSection title={m.booking_new_clients()} open={true} badgeVariant="progress">
					<div class="space-y-2">
						<div class="relative">
							<input type="text" bind:value={regularSearch} placeholder={m.booking_new_client_search()} autocomplete="off" class="input w-full" />
							{#if filteredRegularClients.length > 0}
								<ul class="absolute z-10 mt-1 w-full rounded-(--radius-card) border border-border bg-white shadow-lg">
									{#each filteredRegularClients as c}
										<li><button type="button" onclick={() => addRegularClient(c)} class="w-full px-3 py-2 text-left text-sm hover:bg-ocean/5">{c.firstName} {c.lastName}{#if c.phone} · {c.phone}{/if}</button></li>
									{/each}
								</ul>
							{/if}
						</div>
						{#each regularClients as sc, i}
							<div class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
								<span>{sc.name}</span>
								<div class="flex items-center gap-2">
									<span class="text-muted">€</span>
									<input type="number" name="amountDue" bind:value={regularClients[i].amountDue} step="0.01" min="0" class="w-20 rounded border border-border px-1 py-0.5 text-right text-sm" />
									<input type="hidden" name="clientId" value={sc.clientId} />
									<button type="button" onclick={() => { regularClients = regularClients.filter(c => c.clientId !== sc.clientId); }} class="text-muted hover:text-red-500">✕</button>
								</div>
							</div>
						{/each}
					</div>
				</FormSection>
				<!-- Repeat days -->
				<FormSection title={m.booking_new_additional_days()} open={false} badgeVariant="neutral">
					<div class="space-y-2">
						{#each extraDays as _, i}
							<div class="flex gap-2">
								<input type="date" name="extraDate" bind:value={extraDays[i].date} class="input flex-1" />
								<input type="time" name="extraTime" bind:value={extraDays[i].time} class="input w-32" />
								<button type="button" onclick={() => { extraDays = extraDays.filter((_, idx) => idx !== i); }} class="text-muted hover:text-red-500">✕</button>
							</div>
						{/each}
						<button type="button" onclick={() => { extraDays = [...extraDays, { date: '', time: '' }]; }} class="text-sm text-ocean hover:underline">
							{m.booking_new_add_day()}
						</button>
						<p class="text-xs text-muted">{m.booking_new_repeat_hint()}</p>
					</div>
				</FormSection>
			{/if}

			<!-- ── Notes (all types) ──────────────────────────────────────────── -->
			<FormSection title={m.booking_new_notes_section()} open={notesOpen} badgeVariant="neutral">
				<NotesSection bind:spotNotes bind:notes />
			</FormSection>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="btn-primary mt-6 w-full"
		>
			{loading ? m.booking_new_saving() : m.booking_new_title()}
		</button>
	</form>
</div>
```

- [ ] **Step 2: Verify TypeScript/Svelte check passes**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```

Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(app\)/bookings/new/+page.svelte src/lib/components/bookings/
git commit -m "feat(ui): unified accordion booking form"
```

---

### Task 10: Update `bookings/new/+page.server.ts`

**Files:**
- Modify: `src/routes/(app)/bookings/new/+page.server.ts`

Accept `participantCount`, `sessionDate[n]`, `sessionTime[n]`, `sessionLevel[n]`, `sessionInstructor[n][]` from the new form.

- [ ] **Step 1: Update the `hasSessions` branch**

Replace the `hasSessions` block (from `if (service.hasSessions)` to its `return`) with:

```ts
if (service.hasSessions) {
    const sessionsIncludedRaw = form.get('sessionsIncluded')?.toString();
    const sessionsIncluded = sessionsIncludedRaw ? Math.max(1, parseInt(sessionsIncludedRaw)) : 1;

    // Participant count vs named participants
    const participantCountRaw = form.get('participantCount')?.toString();
    const participantCount = participantCountRaw ? parseInt(participantCountRaw) : undefined;
    const participantNames = form.getAll('participantName')
        .map(n => n.toString().trim())
        .filter(Boolean);

    const booking = await createBooking({
        serviceId, serviceRunId, date, isFlexible, status, spotNotes, notes,
        sessionsIncluded,
        participantCount,
        clients: bookingClients
    });

    // Per-session data from accordion form
    const createdSessions = await Promise.all(
        Array.from({ length: sessionsIncluded }, (_, i) => {
            const sessionDate = form.get(`sessionDate[${i}]`)?.toString() || date;
            const sessionTime = form.get(`sessionTime[${i}]`)?.toString() || undefined;
            const sessionFlexible = form.get(`sessionFlexible[${i}]`)?.toString() === 'on';
            const sessionLevel = (form.get(`sessionLevel[${i}]`)?.toString() || undefined) as
                'beginner' | 'intermediate' | 'advanced' | undefined;
            const sessionInstructorIds = form.getAll(`sessionInstructor[${i}][]`).map(String).filter(Boolean);
            return createSession({
                bookingId: booking.id,
                date: sessionDate,
                time: !sessionFlexible && sessionTime ? sessionTime : undefined,
                skillLevel: sessionLevel,
                instructorIds: sessionInstructorIds,
                sortOrder: i
            });
        })
    );

    // Named participants: add to booking + all sessions
    if (participantNames.length > 0) {
        await bulkAddBookingParticipants(booking.id, participantNames);
        await Promise.all(
            createdSessions.flatMap(s =>
                participantNames.map(name => addParticipant({ sessionId: s.id, name }))
            )
        );
    }

    const scheduled = createdSessions.filter(s => s.time).length;
    const remaining = sessionsIncluded - scheduled;
    const msg = scheduled > 0
        ? remaining > 0
            ? `Booking created — ${scheduled} session${scheduled > 1 ? 's' : ''} scheduled, ${remaining} to schedule`
            : `Booking created — ${scheduled} session${scheduled > 1 ? 's' : ''} scheduled`
        : `Booking created — ${sessionsIncluded} session${sessionsIncluded > 1 ? 's' : ''} to schedule`;
    return { bookingId: booking.id, message: msg };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(app\)/bookings/new/+page.server.ts
git commit -m "feat(server): accept participantCount and per-session data in booking creation"
```

---

### Task 11: Update `bookings/[id]/+page.server.ts` — add `skillLevel` to session update

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.server.ts`

- [ ] **Step 1: Add `skillLevel` to the `updateSession` action**

Find the `updateSession` action (around line 174). It currently calls:

```ts
await updateSession(sessionId, { time, durationMinutes, notes, instructorIds });
```

Replace with:

```ts
const skillLevelRaw = form.get('sessionLevel')?.toString() || null;
const skillLevel = (skillLevelRaw as 'beginner' | 'intermediate' | 'advanced' | null) ?? null;
await updateSession(sessionId, { time, durationMinutes, notes, instructorIds, skillLevel });
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/\(app\)/bookings/\[id\]/+page.server.ts
git commit -m "feat(server): persist skillLevel on session update"
```

---

### Task 12: Update `bookings/[id]/+page.svelte` — level badge, participant count, i18n fixes

**Files:**
- Modify: `src/routes/(app)/bookings/[id]/+page.svelte`

This is a targeted audit pass: replace hardcoded strings, add level badge to session cards, show participant count, add level selector to session edit form. Read the current file before editing.

- [ ] **Step 1: Replace hardcoded session management strings**

Search for each of the following hardcoded strings and replace with the corresponding `m.key()` call:

| Hardcoded | Replace with |
|---|---|
| `"Generate"` (button) | `m.booking_detail_session_generate()` |
| `"+ Add"` (button) | `m.booking_detail_session_add()` |
| `"Cancel"` (session form cancel button) | `m.common_cancel()` (check existing key) or add new |
| `"New session"` (form header) | `m.booking_detail_session_new()` |
| `"Date *"` (label) | `m.booking_detail_session_date()` |
| `"Time"` (session label) | `m.booking_detail_session_time()` |
| `"Duration (min)"` | `m.booking_detail_session_duration()` |
| `"Notes / spot"` | `m.booking_detail_session_notes()` |
| `"Instructors"` (session form) | `m.booking_detail_session_instructors()` |
| `"Add session"` | `m.booking_detail_session_save()` |
| `"Save session"` | `m.booking_detail_session_save()` |
| `"Edit"` (session edit btn) | `m.booking_detail_session_edit()` |
| `"Cancel this session?"` | `m.booking_detail_session_cancel_confirm()` |
| `"unscheduled"` (badge) | `m.booking_detail_session_unscheduled()` |
| `"Attending"` | `m.booking_detail_session_attending()` |
| `"Defaults to booking client"` | `m.booking_detail_session_defaults_to_client()` |
| `"need a time assigned"` | `m.booking_detail_needs_time()` |
| `"No sessions yet — use Generate or + Add."` | `m.booking_detail_no_sessions()` |
| `"Generate for {date} → {date}"` | `m.booking_detail_generate_for({ start: ..., end: ... })` |
| `"Sessions / day"` | `m.booking_detail_sessions_per_day()` |
| `"Times"` | `m.booking_detail_sessions_times()` |
| `"Weekdays only"` | `m.booking_detail_weekdays_only()` |
| `"Clear existing sessions first"` | `m.booking_detail_clear_existing()` |
| `"Generate sessions"` (submit) | `m.booking_detail_generate_sessions()` |
| `"Cancelled"` (section header) | `m.booking_detail_cancelled_label()` |
| `"Save"` (payment form) | `m.booking_detail_save_payment()` |
| `"Saving…"` (loading state) | `m.booking_new_saving()` |
| `"Additional days"` | `m.booking_new_additional_days()` |

- [ ] **Step 2: Add level badge to session cards**

Find the session card status badge section (where status badges like "cancelled", "unscheduled" are shown). After the status badge, add:

```svelte
{#if session.skillLevel}
    {@const levelLabel = session.skillLevel === 'beginner'
        ? m.skill_level_beginner()
        : session.skillLevel === 'intermediate'
            ? m.skill_level_intermediate()
            : m.skill_level_advanced()}
    <span class="rounded-full bg-ocean/10 px-2 py-0.5 text-xs font-medium text-ocean">
        {levelLabel}
    </span>
{/if}
```

- [ ] **Step 3: Add level selector to session edit form**

In the edit session form (the inline edit form, not the create form), add after the notes field:

```svelte
<div>
    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {m.booking_detail_session_level()}
    </label>
    <div class="flex gap-2">
        {#each [
            { value: 'beginner', label: m.skill_level_beginner() },
            { value: 'intermediate', label: m.skill_level_intermediate() },
            { value: 'advanced', label: m.skill_level_advanced() }
        ] as lvl}
            <button
                type="button"
                onclick={() => { editSessionLevel = editSessionLevel === lvl.value ? '' : lvl.value; }}
                class="flex-1 rounded-md border py-1.5 text-xs font-medium
                    {editSessionLevel === lvl.value
                    ? 'border-ocean bg-ocean/10 text-ocean'
                    : 'border-border text-muted hover:border-ocean/40'}"
            >
                {lvl.label}
            </button>
        {/each}
    </div>
    <input type="hidden" name="sessionLevel" value={editSessionLevel} />
</div>
```

Add `let editSessionLevel = $state('')` to the script block, and when opening the edit form populate it from `session.skillLevel ?? ''`.

- [ ] **Step 4: Show participant count in booking details panel**

Find the booking details section where `participants` are shown. Add before the participants list:

```svelte
{#if data.booking.participantCount}
    <div class="flex items-center justify-between py-1">
        <span class="text-sm text-muted">{m.booking_new_participants()}</span>
        <span class="text-sm font-medium">{m.booking_detail_participant_count({ count: data.booking.participantCount })}</span>
    </div>
{/if}
```

- [ ] **Step 5: Add visual hierarchy to sessions section header**

Find the `<h2>` or section header for "Sessions". Add a left-border accent:

```svelte
<h2 class="mb-3 border-l-4 border-ocean pl-3 text-sm font-semibold uppercase tracking-wide text-muted">
    {m.booking_detail_sessions()}
</h2>
```

- [ ] **Step 6: Svelte check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```

Fix any errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/\(app\)/bookings/\[id\]/+page.svelte
git commit -m "feat(ui): level badge, participant count, i18n fixes on booking detail"
```

---

### Task 13: Verify end-to-end — check TypeScript build

- [ ] **Step 1: Full type check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Final commit if any loose files**

```bash
git status
```

If anything unstaged, commit it.

---

## Self-Review Checklist

- [x] Schema changes (Task 1) ✓
- [x] Type updates (Task 2) ✓
- [x] Query updates (Task 3) ✓
- [x] i18n keys both languages (Task 4) ✓
- [x] FormSection accordion component (Task 5) ✓
- [x] SessionSection with level selector (Task 6) ✓
- [x] BookingBasics with participant count toggle (Task 7) ✓
- [x] NotesSection (Task 8) ✓
- [x] New booking page rework — all 4 service types (Task 9) ✓
- [x] Server action updated — participantCount + per-session fields (Task 10) ✓
- [x] Booking detail server — skillLevel on update (Task 11) ✓
- [x] Booking detail page — level badge + participant count + i18n fixes (Task 12) ✓
- [x] Type names consistent across tasks: `participantCount`, `skillLevel`, `SessionSection`, `BookingBasics`, `FormSection`, `NotesSection` ✓
- [x] `m.booking_new_spot_notes()` and `m.booking_new_notes()` — these keys must exist in en.json before Task 8; verify or add them ✓ (pre-existing)
