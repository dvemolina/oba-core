<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Calendar, BookOpen, Users, LayoutGrid, Sun, UserCheck, Settings, Grid2X2, X } from 'lucide-svelte';

	let { role = 'instructor' }: { role: string } = $props();

	const allItems = [
		{ href: '/agenda',    label: 'Today',    icon: Sun,        roles: ['admin','owner','manager','instructor'] },
		{ href: '/calendar',  label: 'Calendar', icon: Calendar,   roles: ['admin','owner','manager','instructor'] },
		{ href: '/bookings',  label: 'Bookings', icon: BookOpen,   roles: ['admin','owner','manager'] },
		{ href: '/clients',   label: 'Clients',  icon: Users,      roles: ['admin','owner','manager'] },
		{ href: '/services',  label: 'Services', icon: LayoutGrid, roles: ['admin','owner','manager'] },
		{ href: '/staff',     label: 'Staff',    icon: UserCheck,  roles: ['admin','owner'] },
		{ href: '/settings',  label: 'Settings', icon: Settings,   roles: ['admin','owner','manager','instructor'] },
	];

	const visibleItems = $derived(allItems.filter(i => i.roles.includes(role)));
	const mainItems = $derived(visibleItems.slice(0, 4));
	const moreItems = $derived(visibleItems);

	let moreOpen = $state(false);
	function close() { moreOpen = false; }
	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<div class="fixed right-0 bottom-0 left-0 z-50 md:hidden">
	{#if moreOpen}
		<div
			transition:fly={{ y: 16, duration: 220, easing: cubicOut }}
			class="border-t border-border bg-surface/98 backdrop-blur-md"
		>
			<div class="grid grid-cols-4 gap-0 px-2 pt-3 pb-1">
				{#each moreItems as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						onclick={close}
						class="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-colors
						       {active ? 'text-ocean' : 'text-gray-700 hover:bg-sand'}"
					>
						<span class="relative flex h-6 w-6 items-center justify-center">
							{#if active}<span class="absolute inset-0 rounded-lg bg-ocean/12"></span>{/if}
							<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
						</span>
						<span class="text-[10px] font-medium">{item.label}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<nav
		aria-label="Main navigation"
		class="flex justify-around border-t border-border bg-surface/95 backdrop-blur-md"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		{#each mainItems as item}
			{@const active = !moreOpen && isActive(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				aria-label={item.label}
				onclick={close}
				class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
				       transition-colors duration-150
				       {active ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
			>
				<span class="relative flex h-6 w-6 items-center justify-center">
					{#if active}<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>{/if}
					<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
				</span>
				<span class="truncate">{item.label}</span>
			</a>
		{/each}

		<button
			onclick={() => moreOpen = !moreOpen}
			aria-label={moreOpen ? 'Close menu' : 'More'}
			class="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium
			       transition-colors duration-150
			       {moreOpen ? 'text-ocean' : 'text-muted hover:text-slate-700'}"
		>
			<span class="relative flex h-6 w-6 items-center justify-center">
				{#if moreOpen}
					<span class="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-ocean"></span>
					<X size={20} strokeWidth={2.5} />
				{:else}
					<Grid2X2 size={20} strokeWidth={1.75} />
				{/if}
			</span>
			<span class="truncate">{moreOpen ? 'Close' : 'More'}</span>
		</button>
	</nav>
</div>
