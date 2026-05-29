<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, Users, UserCheck, LayoutGrid, Settings, Waves } from 'lucide-svelte';

	const items = [
		{ href: '/calendar',    label: 'Calendar',  icon: Calendar    },
		{ href: '/clients',     label: 'Clients',   icon: Users       },
		{ href: '/instructors', label: 'Staff',     icon: UserCheck   },
		{ href: '/services',    label: 'Services',  icon: LayoutGrid  },
		{ href: '/settings',    label: 'Settings',  icon: Settings    }
	];
</script>

<nav
	aria-label="Main navigation"
	class="group hidden shrink-0 flex-col overflow-hidden bg-navy transition-[width] duration-200 ease-out md:flex"
	style="width: 3.75rem;"
	onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.width = '13rem')}
	onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.width = '3.75rem')}
>
	<!-- Brand -->
	<div class="flex h-14 items-center gap-3 px-3.5 border-b border-white/10">
		<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean text-white">
			<Waves size={16} strokeWidth={2} />
		</span>
		<span class="overflow-hidden whitespace-nowrap text-sm font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
			OBA
		</span>
	</div>

	<!-- Nav items -->
	<div class="flex flex-1 flex-col gap-0.5 p-2 pt-3">
		{#each items as item}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label}
				class="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150
				       {active
				         ? 'bg-ocean text-white'
				         : 'text-white/55 hover:bg-white/8 hover:text-white'}"
			>
				<span class="flex h-5 w-5 shrink-0 items-center justify-center">
					<item.icon size={18} strokeWidth={active ? 2.5 : 1.75} />
				</span>
				<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
					{item.label}
				</span>
			</a>
		{/each}
	</div>
</nav>
