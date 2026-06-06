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

<div class="rounded-(--radius-card) ring-1 {open ? 'ring-ocean/60' : 'ring-border'}">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between bg-surface px-4 py-3 text-left rounded-t-(--radius-card) {open ? '' : 'rounded-b-(--radius-card)'}"
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
		<div class="border-t border-border bg-white px-4 py-4 rounded-b-(--radius-card)">
			{@render children()}
		</div>
	{/if}
</div>
