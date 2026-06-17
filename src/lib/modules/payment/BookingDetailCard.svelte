<script lang="ts">
    import { enhance } from '$app/forms';
    import { withToast } from '$lib/utils/enhance';
    import type { ServiceModules } from '$lib/features/services/modules';
    import { fmtPricingFormula } from '$lib/utils/pricing';
    import type { PricingMode } from '$lib/features/services/types';

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
        canSeeFinancials,
        servicePricingMode = null,
        sessionsIncluded = null
    }: {
        booking: { id: string; clients: Enrollment[]; serviceBasePrice: string | null; pricingMode?: string | null };
        modules: ServiceModules;
        canSeeFinancials: boolean;
        servicePricingMode?: string | null;
        sessionsIncluded?: number | null;
    } = $props();

    const activeClients = $derived(booking.clients.filter(c => c.status !== 'cancelled'));
    const totalDue  = $derived(activeClients.reduce((s, c) => s + parseFloat(c.amountDue ?? '0'), 0));
    const totalPaid = $derived(activeClients.reduce((s, c) => s + parseFloat(c.amountPaid ?? '0'), 0));

    const mode = $derived((servicePricingMode ?? booking.pricingMode ?? null) as PricingMode | null);
    const basePrice = $derived(booking.serviceBasePrice ?? '0');

    function formula(bc: Enrollment): string | null {
        if (!mode || !basePrice || bc.priceOverride) return null;
        return fmtPricingFormula(basePrice, mode, {
            participants: bc.participantCount ?? 1,
            sessions: sessionsIncluded ?? 1
        });
    }

    let editingDueFor = $state<string | null>(null);
</script>

{#if canSeeFinancials}
<div class="rounded-(--radius-card) overflow-hidden border border-gray-200 bg-white">
    <div class="bg-gray-50 px-4 py-2.5">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-600">💰 Pago</span>
    </div>

    <div class="divide-y divide-border/40">
        {#each activeClients as bc (bc.id)}
            <div class="px-4 py-2.5">
                <div class="flex items-center justify-between">
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
                <!-- Pricing formula breakdown -->
                {#if formula(bc)}
                    <p class="mt-0.5 text-[10px] text-muted">{formula(bc)}</p>
                {/if}
                {#if bc.priceOverride}
                    <p class="mt-0.5 text-[10px] text-amber-600">Precio personalizado</p>
                {/if}
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
            {:else if totalPaid >= totalDue && totalDue > 0}
                <span class="ml-2 text-xs text-green-700">✓ Cobrado</span>
            {/if}
        </div>
    </div>
</div>
{/if}
