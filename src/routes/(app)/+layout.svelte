<script lang="ts">
	import BottomNav from '$lib/components/nav/BottomNav.svelte';
	import Sidebar from '$lib/components/nav/Sidebar.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	const role = $derived(data.role ?? 'instructor');
</script>

<div class="flex h-screen overflow-hidden bg-sand">
	<Sidebar {role} />
	<main class="min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">
		{@render children()}
	</main>
	<BottomNav {role} />
</div>

<Toaster />
