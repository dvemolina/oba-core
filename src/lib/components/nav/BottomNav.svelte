<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, Users, UserCheck, LayoutGrid, Settings } from 'lucide-svelte';

	const items = [
		{ href: '/calendar',     label: 'Calendar',  icon: Calendar     },
		{ href: '/clients',      label: 'Clients',   icon: Users        },
		{ href: '/instructors',  label: 'Staff',     icon: UserCheck    },
		{ href: '/services',     label: 'Services',  icon: LayoutGrid   },
		{ href: '/settings',     label: 'Settings',  icon: Settings     }
	];
</script>

<nav
	aria-label="Main navigation"
	class="fixed right-0 bottom-0 left-0 z-50 flex justify-around border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	{#each items as item}
		{@const active = page.url.pathname.startsWith(item.href)}
		<a
			href={item.href}
			aria-current={active ? 'page' : undefined}
			aria-label={item.label}
			class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
			       transition-colors duration-150
			       {active ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
		>
			<span class="relative flex h-6 w-6 items-center justify-center">
				{#if active}
					<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>
				{/if}
				<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
			</span>
			<span class="truncate">{item.label}</span>
		</a>
	{/each}
</nav>
