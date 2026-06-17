<script lang="ts">
    import { enhance } from '$app/forms';
    import { withToast } from '$lib/utils/enhance';
    import type { ServiceModules } from '$lib/features/services/modules';
    // enhance/withToast kept for the booking-level instructor edit form (non-sessions path)

    let {
        booking,
        modules,
        instructors,
        sessions = []
    }: {
        booking: { id: string; instructorId: string | null; instructorName: string | null; status: string; date?: string; isFlexible?: boolean };
        modules: ServiceModules;
        instructors: Array<{ id: string; name: string }>;
        sessions: Array<{ id: string; date: string; time: string | null; instructorId?: string | null; instructorName?: string | null }>;
    } = $props();

    const hasSessions = $derived('sessions' in modules);
    let editingInstructor = $state(false);
    let selectedInstructorId = $state(booking.instructorId ?? '');
    $effect(() => { selectedInstructorId = booking.instructorId ?? ''; });
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
            <!-- Read-only summary — instructor assignment is managed in the sessions card -->
            {#if sessions.length === 0}
                <p class="text-sm text-muted">Los instructores se asignan por sesión.</p>
            {:else}
                {@const assignedNames = [...new Set(
                    sessions.flatMap(s => (s as any).instructors ?? []).map((i: any) => i.instructorName).filter(Boolean)
                )]}
                {#if assignedNames.length > 0}
                    <p class="text-sm text-gray-800">{assignedNames.join(', ')}</p>
                {:else}
                    <p class="text-sm text-muted">Sin asignar</p>
                {/if}
                <p class="mt-1 text-[10px] text-muted">Gestiona los instructores en el módulo de sesiones.</p>
            {/if}
        {/if}
    </div>
</div>
