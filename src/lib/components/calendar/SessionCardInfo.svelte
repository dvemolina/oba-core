<!-- src/lib/components/calendar/SessionCardInfo.svelte -->
<script lang="ts">
	import { getServiceColor } from '$lib/features/services/colors';

	let {
		serviceName,
		serviceColor,
		time,
		participantNames,
		bookingStatus,
		date
	}: {
		serviceName: string | null;
		serviceColor: string | null;
		time: string | null;
		participantNames: string[];
		bookingStatus: string;
		date: string;
	} = $props();

	const color = $derived(getServiceColor(serviceColor ?? ''));

	const statusClass = $derived(
		bookingStatus === 'confirmed'
			? 'bg-emerald-50 text-emerald-700'
			: bookingStatus === 'cancelled'
				? 'bg-gray-100 text-gray-400'
				: 'bg-amber-50 text-amber-700'
	);
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center gap-2">
		<span class="h-2.5 w-2.5 shrink-0 rounded-full {color.bg} ring-1 {color.border}"></span>
		<span class="text-sm font-semibold text-gray-900">{serviceName ?? '—'}</span>
	</div>
	<p class="text-xs text-muted">
		{new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
		{#if time} · {time.slice(0, 5)}{/if}
	</p>
	{#if participantNames.length > 0}
		<p class="text-xs text-gray-700">
			{participantNames[0]}
			{#if participantNames.length > 1}
				<span class="text-muted"> +{participantNames.length - 1}</span>
			{/if}
		</p>
	{/if}
	<span class="inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium {statusClass}">
		{bookingStatus}
	</span>
</div>
