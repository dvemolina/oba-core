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
