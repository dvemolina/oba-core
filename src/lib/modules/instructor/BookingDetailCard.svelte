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
        sessions: Array<{ id: string; date: string; time: string | null; durationMinutes: number | null; instructors?: Array<{ instructorId: string; instructorName: string | null }> }>;
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
            <!-- Per-session instructor breakdown -->
            {#if sessions.length === 0}
                <p class="text-sm text-muted">Los instructores se asignan por sesión.</p>
            {:else}
                {@const activeSessions = sessions.filter(s => (s as any).status !== 'cancelled')}
                <div class="space-y-1.5">
                    {#each activeSessions as s (s.id)}
                        {@const sessionInstructors = s.instructors ?? []}
                        {@const timeStr = s.time ? s.time.slice(0, 5) : null}
                        <div class="flex items-center justify-between gap-2 rounded-lg bg-green-50/60 px-2.5 py-1.5 ring-1 ring-green-100">
                            <div class="min-w-0">
                                <p class="text-xs font-medium text-gray-800">
                                    {s.date}{timeStr ? ' · ' + timeStr : ''}
                                </p>
                                {#if sessionInstructors.length > 0}
                                    <p class="text-[11px] text-green-700">{sessionInstructors.map(i => i.instructorName).filter(Boolean).join(', ')}</p>
                                {:else}
                                    <p class="text-[11px] text-amber-600">⚠ Sin asignar</p>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
                <p class="mt-2 text-[10px] text-muted">Gestiona los instructores en el módulo de sesiones.</p>
            {/if}
        {/if}
    </div>
</div>
