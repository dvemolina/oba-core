<!-- src/lib/components/ui/Popover.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		open,
		triggerRect,
		onclose,
		children
	}: {
		open: boolean;
		triggerRect: DOMRect | null;
		onclose: () => void;
		children?: Snippet;
	} = $props();

	let popoverEl = $state<HTMLDivElement | null>(null);
	let top = $state(0);
	let left = $state(0);

	$effect(() => {
		if (open && triggerRect) {
			tick().then(() => {
				if (!popoverEl) return;
				const pw = popoverEl.offsetWidth;
				const ph = popoverEl.offsetHeight;
				let t = triggerRect.bottom + 6;
				let l = triggerRect.left;
				if (l + pw > window.innerWidth - 8) l = Math.max(8, window.innerWidth - pw - 8);
				if (t + ph > window.innerHeight - 8) t = triggerRect.top - ph - 6;
				top = Math.max(8, t);
				left = Math.max(8, l);
			});
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleMousedown(e: MouseEvent) {
		if (popoverEl && !popoverEl.contains(e.target as Node)) onclose();
	}
</script>

<svelte:document onkeydown={handleKeydown} onmousedown={handleMousedown} />

{#if open}
	<div
		bind:this={popoverEl}
		style="position:fixed;top:{top}px;left:{left}px"
		class="z-50 min-w-52 rounded-xl border border-border bg-white p-3 shadow-lg"
		role="tooltip"
	>
		{@render children?.()}
	</div>
{/if}
