<script lang="ts">
	import BottomNav from '$lib/components/nav/BottomNav.svelte';
	import Sidebar from '$lib/components/nav/Sidebar.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen bg-sand">
	<Sidebar />
	<main class="min-w-0 flex-1 pb-16 md:pb-0">
		{@render children()}
	</main>
	<BottomNav />
</div>
