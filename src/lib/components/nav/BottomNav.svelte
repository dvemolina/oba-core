<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/calendar', label: 'Calendar', icon: '📅' },
		{ href: '/clients', label: 'Clients', icon: '👥' },
		{ href: '/instructors', label: 'Staff', icon: '🌊' },
		{ href: '/services', label: 'Services', icon: '🛍️' },
		{ href: '/settings', label: 'Settings', icon: '⚙️' }
	];
</script>

<nav
	class="fixed right-0 bottom-0 left-0 z-50 flex justify-around border-t border-border bg-surface py-2 md:hidden"
>
	{#each items as item}
		{@const active = page.url.pathname.startsWith(item.href)}
		<a
			href={item.href}
			class="flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors {active
				? 'text-ocean'
				: 'text-muted hover:text-gray-700'}"
		>
			<span class="text-lg leading-none">{item.icon}</span>
			<span>{item.label}</span>
		</a>
	{/each}
</nav>
