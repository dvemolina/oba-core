<script lang="ts">
	import { SERVICE_COLORS, DOT_COLORS, COLOR_LABELS, DEFAULT_COLOR } from '$lib/features/services/colors';
	import type { ServiceColorKey } from '$lib/features/services/colors';

	let {
		selected = DEFAULT_COLOR,
		name = 'color'
	}: { selected?: string; name?: string } = $props();

	let current = $state<ServiceColorKey>(
		(selected in SERVICE_COLORS ? selected : DEFAULT_COLOR) as ServiceColorKey
	);

	const keys = Object.keys(SERVICE_COLORS) as ServiceColorKey[];
</script>

<div class="flex flex-wrap gap-2">
	{#each keys as key}
		<button
			type="button"
			title={COLOR_LABELS[key]}
			onclick={() => (current = key)}
			class="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
			style="background-color: {DOT_COLORS[key]}; focus-ring-color: {DOT_COLORS[key]}"
			aria-pressed={current === key}
		>
			{#if current === key}
				<svg class="h-3.5 w-3.5 text-white drop-shadow" viewBox="0 0 12 12" fill="none">
					<path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			{/if}
		</button>
	{/each}
</div>
<input type="hidden" {name} value={current} />
