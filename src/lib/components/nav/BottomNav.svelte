<script lang="ts">
	import { page } from '$app/state';
	import { Calendar, BookOpen, Users, LayoutGrid, Sun, UserCheck, Settings, Menu, X } from 'lucide-svelte';

	const items = [
		{ href: '/agenda',    label: 'Today',     icon: Sun        },
		{ href: '/calendar',  label: 'Calendar',  icon: Calendar   },
		{ href: '/bookings',  label: 'Bookings',  icon: BookOpen   },
		{ href: '/clients',   label: 'Clients',   icon: Users      },
		{ href: '/services',  label: 'Services',  icon: LayoutGrid }
	];

	const moreItems = [
		{ href: '/instructors', label: 'Staff',    icon: UserCheck },
		{ href: '/settings',    label: 'Settings', icon: Settings  },
	];

	let moreOpen = $state(false);
	function closeMore() { moreOpen = false; }
</script>

<!-- More: floating button bottom-left (above nav) -->
<button
	onclick={() => moreOpen = !moreOpen}
	aria-label="More options"
	class="fixed left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-navy/90 text-white shadow-lg backdrop-blur-sm transition-transform duration-150 active:scale-95 md:hidden"
	style="bottom: calc(env(safe-area-inset-bottom) + 4.5rem);"
>
	{#if moreOpen}
		<X size={18} strokeWidth={2} />
	{:else}
		<Menu size={18} strokeWidth={2} />
	{/if}
</button>

<!-- Bottom sheet backdrop -->
{#if moreOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden" onclick={closeMore}></div>

	<!-- Sheet -->
	<div class="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-surface shadow-2xl md:hidden"
		style="padding-bottom: env(safe-area-inset-bottom);">
		<!-- Handle -->
		<div class="flex justify-center py-3">
			<div class="h-1 w-10 rounded-full bg-border"></div>
		</div>
		<!-- Menu items -->
		<div class="px-2 pb-4">
			{#each moreItems as item}
				{@const active = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
				<a
					href={item.href}
					onclick={closeMore}
					class="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors
					       {active ? 'bg-ocean/10 text-ocean' : 'text-gray-800 hover:bg-sand'}"
				>
					<item.icon size={20} strokeWidth={active ? 2.5 : 1.75} />
					<span class="text-sm font-medium">{item.label}</span>
				</a>
			{/each}
		</div>
	</div>
{/if}

<!-- Main bottom nav -->
<nav
	aria-label="Main navigation"
	class="fixed right-0 bottom-0 left-0 z-50 flex justify-around border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	{#each items as item}
		{@const active = page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')}
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
