<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, BookOpen, Users, UserCheck, LayoutGrid, Settings, Waves, Sun } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	const PUBLIC_BUSINESS_NAME = env.PUBLIC_BUSINESS_NAME ?? 'OBA';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { role = 'instructor' }: { role: string } = $props();

	const allItems = [
		{ href: '/agenda',    label: () => m.nav_today(),    icon: Sun,        roles: ['admin','owner','manager','instructor'] },
		{ href: '/calendar',  label: () => m.nav_calendar(), icon: Calendar,   roles: ['admin','owner','manager','instructor'] },
		{ href: '/bookings',  label: () => m.nav_bookings(), icon: BookOpen,   roles: ['admin','owner','manager'] },
		{ href: '/clients',   label: () => m.nav_clients(),  icon: Users,      roles: ['admin','owner','manager'] },
		{ href: '/staff',     label: () => m.nav_staff(),    icon: UserCheck,  roles: ['admin','owner'] },
		{ href: '/services',  label: () => m.nav_services(), icon: LayoutGrid, roles: ['admin','owner','manager'] },
	];

	const items = $derived(allItems.filter(i => i.roles.includes(role)));
</script>

<nav
	aria-label="Main navigation"
	class="group hidden shrink-0 flex-col overflow-hidden bg-navy transition-[width] duration-200 ease-out md:flex"
	style="width: 3.75rem;"
	onmouseenter={(e) => ((e.currentTarget as HTMLElement).style.width = '13rem')}
	onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.width = '3.75rem')}
>
	<div class="flex h-14 items-center gap-3 px-3.5 border-b border-white/10">
		<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean text-white">
			<Waves size={16} strokeWidth={2} />
		</span>
		<span class="overflow-hidden whitespace-nowrap text-sm font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
			{PUBLIC_BUSINESS_NAME}
		</span>
	</div>

	<div class="flex flex-1 flex-col gap-0.5 p-2 pt-3">
		{#each items as item}
			{@const active = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label()}
				class="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150
				       {active ? 'bg-ocean text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'}"
			>
				<span class="flex h-5 w-5 shrink-0 items-center justify-center">
					<item.icon size={18} strokeWidth={active ? 2.5 : 1.75} />
				</span>
				<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
					{item.label()}
				</span>
			</a>
		{/each}
	</div>

	<div class="border-t border-white/10 p-2">
		<a
			href="/settings"
			aria-label={m.nav_settings()}
			class="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150
			       {page.url.pathname.startsWith('/settings') ? 'bg-ocean text-white' : 'text-white/40 hover:bg-white/8 hover:text-white'}"
		>
			<span class="flex h-5 w-5 shrink-0 items-center justify-center">
				<Settings size={18} strokeWidth={page.url.pathname.startsWith('/settings') ? 2.5 : 1.75} />
			</span>
			<span class="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
				{m.nav_settings()}
			</span>
		</a>
	</div>

	<!-- Language toggle -->
	<div class="mt-auto border-t border-border/30 pt-2 pb-1 px-3">
		<div class="flex items-center gap-1">
			<a
				href="/api/set-locale?locale=es&from={page.url.pathname}"
				class="rounded px-2 py-1 text-xs font-medium transition-colors {getLocale() === 'es' ? 'bg-ocean/10 text-ocean' : 'text-muted hover:text-gray-700'}"
			>
				ES
			</a>
			<span class="text-xs text-muted/50">·</span>
			<a
				href="/api/set-locale?locale=en&from={page.url.pathname}"
				class="rounded px-2 py-1 text-xs font-medium transition-colors {getLocale() === 'en' ? 'bg-ocean/10 text-ocean' : 'text-muted hover:text-gray-700'}"
			>
				EN
			</a>
		</div>
	</div>
</nav>
