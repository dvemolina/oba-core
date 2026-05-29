<script lang="ts">
	import { toasts, dismiss } from '$lib/stores/toast.svelte';

	const icons: Record<string, string> = {
		success: '✓',
		error: '✕',
		info: 'ℹ',
		warning: '⚠'
	};

	const styles: Record<string, string> = {
		success: 'bg-gray-900 text-white',
		error: 'bg-red-600 text-white',
		info: 'bg-navy text-white',
		warning: 'bg-amber-500 text-white'
	};
</script>

<!-- Fixed top-center on mobile, top-right on desktop -->
<div class="pointer-events-none fixed left-0 right-0 top-4 z-50 flex flex-col items-center gap-2 px-4 md:left-auto md:right-4 md:items-end">
	{#each toasts.list as t (t.id)}
		<div
			class="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ring-black/10 {styles[t.type]}"
			style="animation: toast-in 0.2s ease-out"
		>
			<span class="text-sm font-bold">{icons[t.type]}</span>
			<p class="text-sm font-medium">{t.message}</p>
			<button
				onclick={() => dismiss(t.id)}
				class="ml-2 text-white/60 hover:text-white text-xs"
				aria-label="Dismiss"
			>✕</button>
		</div>
	{/each}
</div>

<style>
	@keyframes toast-in {
		from { opacity: 0; transform: translateY(-8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
</style>
