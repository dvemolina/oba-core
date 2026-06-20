<script lang="ts">
    import type { ServiceModules } from '$lib/features/services/modules';
    import type { CreditsModuleConfig } from '$lib/features/services/modules';

    const CREDIT_TYPE_LABELS: Record<string, string> = {
        sessions: '🏄 Sesiones',
        inventory: '🎒 Alquiler',
        accommodation: '🏠 Alojamiento'
    };

    let {
        booking,
        modules,
        quantity = 1,
        creditsUsed = 0,
        bookingDate = ''
    }: {
        booking: { id: string };
        modules: ServiceModules;
        quantity?: number;
        creditsUsed?: number;
        bookingDate?: string;
    } = $props();

    const config = $derived(modules.credits as CreditsModuleConfig | undefined);
    const totalCredits = $derived((config?.creditsIncluded ?? 0) * quantity);
    const creditsRemaining = $derived(Math.max(0, totalCredits - creditsUsed));

    function fmtDate(iso: string): string {
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    const validityLabel = $derived((): string => {
        if (!config) return '';
        if (config.validityMode === 'range') {
            const from = config.validFrom ? fmtDate(config.validFrom) : null;
            const to = config.validTo ? fmtDate(config.validTo) : null;
            if (from && to) return `Válido del ${from} al ${to}`;
            if (to) return `Válido hasta ${to}`;
            if (from) return `Válido desde ${from}`;
            return 'Sin caducidad';
        }
        if (config.validityMode === 'days' && config.validityDays) {
            return `Válidos ${config.validityDays} días desde la compra`;
        }
        return '';
    });

    const isExpired = $derived((): boolean => {
        if (!config || !bookingDate) return false;
        const ref = new Date(bookingDate + 'T00:00:00');
        if (config.validityMode === 'range') {
            if (config.validTo && ref > new Date(config.validTo + 'T23:59:59')) return true;
        }
        return false;
    });
</script>

<div class="rounded-(--radius-card) overflow-hidden border border-purple-100 bg-white">
    <div class="flex items-center justify-between bg-purple-50 px-4 py-2.5">
        <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-purple-700">
                🎟 Créditos
            </span>
            {#if config?.creditType}
                <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">{CREDIT_TYPE_LABELS[config.creditType] ?? config.creditType}</span>
            {/if}
        </div>
        {#if isExpired()}
            <span class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Caducados</span>
        {:else if creditsRemaining === 0 && creditsUsed > 0}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-muted">Agotados</span>
        {:else}
            <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">{creditsRemaining} disponibles</span>
        {/if}
    </div>

    <div class="divide-y divide-border/40">
        <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-xs text-muted">Incluidos</span>
            <span class="text-sm font-semibold text-gray-800">
                {#if quantity > 1}
                    {quantity}× {config?.creditsIncluded ?? 0} = {totalCredits}
                {:else}
                    {config?.creditsIncluded ?? 0}
                {/if}
            </span>
        </div>
        {#if creditsUsed > 0}
            <div class="flex items-center justify-between px-4 py-2.5">
                <span class="text-xs text-muted">Usados</span>
                <span class="text-sm text-gray-700">{creditsUsed}</span>
            </div>
            <div class="flex items-center justify-between px-4 py-2.5">
                <span class="text-xs text-muted">Disponibles</span>
                <span class="text-sm font-semibold {creditsRemaining > 0 ? 'text-purple-700' : 'text-muted'}">{creditsRemaining}</span>
            </div>
        {/if}
        {#if validityLabel()}
            <div class="px-4 py-2.5">
                <span class="text-[10px] {isExpired() ? 'text-red-500' : 'text-muted'}">{validityLabel()}</span>
            </div>
        {/if}
        {#if config?.compatibleServiceIds && config.compatibleServiceIds.length > 0}
            <div class="px-4 py-2.5">
                <p class="text-[10px] text-muted">Válidos en {config.compatibleServiceIds.length} servicio{config.compatibleServiceIds.length !== 1 ? 's' : ''} específico{config.compatibleServiceIds.length !== 1 ? 's' : ''}</p>
            </div>
        {:else}
            <div class="px-4 py-2.5">
                <p class="text-[10px] text-muted">Válidos en todos los servicios</p>
            </div>
        {/if}
    </div>
</div>
