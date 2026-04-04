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
	aria-label="Main navigation"
	class="group hidden shrink-0 flex-col overflow-hidden bg-navy transition-all duration-200 md:flex"
	style="width: 3.5rem;"
	onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.width = '12rem')}
	onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.width = '3.5rem')}
>
	<!-- Logo -->
	<div class="flex items-center gap-3 px-4 py-4 text-white">
		<span class="shrink-0 text-xl">🏄</span>
		<span class="overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-opacity group-hover:opacity-100">
			OBA
		</span>
	</div>

	{#each items as item}
		{@const active = page.url.pathname.startsWith(item.href)}
		<a
			href={item.href}
			aria-current={active ? 'page' : undefined}
			aria-label={item.label}
			class="flex items-center gap-3 px-4 py-3 text-sm transition-colors {active
				? 'bg-white/10 text-white'
				: 'text-white/60 hover:bg-white/5 hover:text-white'}"
		>
			<span class="shrink-0 text-lg leading-none">{item.icon}</span>
			<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
				{item.label}
			</span>
		</a>
	{/each}

	<!-- Spacer -->
	<div class="flex-1"></div>
</nav>
