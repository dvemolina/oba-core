<!-- src/lib/components/calendar/SessionCardInfo.svelte -->
<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';

	let {
		serviceName,
		serviceColor,
		time,
		ownerType = 'booking',
		firstClientName = null,
		enrolledCount = 0,
		totalParticipants = 0,
		bookingStatus = '',
		date,
		totalAmountDue = 0,
		totalAmountPaid = 0
	}: {
		serviceName: string | null;
		serviceColor: string | null;
		time: string | null;
		ownerType?: 'booking' | 'service' | 'edition';
		firstClientName?: string | null;
		enrolledCount?: number;
		totalParticipants?: number;
		bookingStatus?: string;
		date: string;
		totalAmountDue?: number;
		totalAmountPaid?: number;
	} = $props();

	const color = $derived(getServiceColor(serviceColor ?? ''));

	const isGroup = $derived(ownerType === 'service');
	const isEdition = $derived(ownerType === 'edition');

	const title = $derived(
		isGroup || isEdition
			? (serviceName ?? '—')
			: firstClientName
				? `${serviceName ?? '—'} · ${firstClientName}`
				: (serviceName ?? '—')
	);

	const paymentStatus = $derived(
		totalAmountDue <= 0
			? null
			: totalAmountPaid >= totalAmountDue
				? 'paid'
				: totalAmountPaid > 0
					? 'partial'
					: 'unpaid'
	);

	const paymentClass = $derived(
		paymentStatus === 'paid'
			? 'bg-emerald-50 text-emerald-700'
			: paymentStatus === 'partial'
				? 'bg-amber-50 text-amber-700'
				: 'bg-red-50 text-red-600'
	);

	const paymentLabel = $derived(
		paymentStatus === 'paid'
			? '✓ Cobrado'
			: paymentStatus === 'partial'
				? `⚠ Parcial (${totalAmountPaid.toFixed(0)}/${totalAmountDue.toFixed(0)})`
				: '⚠ Pendiente'
	);
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center gap-2">
		<span class="h-2.5 w-2.5 shrink-0 rounded-full {color.bg} ring-1 {color.border}"></span>
		<span class="text-sm font-semibold text-gray-900">{title}</span>
	</div>
	<p class="text-xs text-muted">
		{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
		{#if time} · {time.slice(0, 5)}{/if}
	</p>
	{#if isGroup}
		<p class="text-xs text-gray-700">
			{#if enrolledCount > 0}
				<span class="font-medium">{enrolledCount} alumno{enrolledCount !== 1 ? 's' : ''} inscritos</span>
			{:else}
				Sin inscritos aún
			{/if}
			{#if totalParticipants > 0}
				· {totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}
			{/if}
		</p>
	{:else if isEdition}
		{#if totalParticipants > 0}
			<p class="text-xs text-gray-700">{totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}</p>
		{/if}
	{:else}
		{#if totalParticipants > 0}
			<p class="text-xs text-gray-700">{totalParticipants} participante{totalParticipants !== 1 ? 's' : ''}</p>
		{/if}
		{#if bookingStatus}
			<div class="flex flex-wrap gap-1.5">
				<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium {bookingStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : bookingStatus === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-amber-50 text-amber-700'}">
					{bookingStatus}
				</span>
				{#if paymentStatus}
					<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium {paymentClass}">
						{paymentLabel}
					</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>
