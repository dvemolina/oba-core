<!-- src/lib/components/calendar/SessionCard.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getServiceColor } from '$lib/features/services/colors';
	import Popover from '$lib/components/ui/Popover.svelte';
	import SessionCardInfo from './SessionCardInfo.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { AgendaSession } from '$lib/features/sessions/types';
	import { sessionDetailLink } from '$lib/features/sessions/link';

	let {
		session,
		size
	}: {
		session: AgendaSession;
		size: 'compact' | 'medium';
	} = $props();

	const color = $derived(getServiceColor(session.serviceColor ?? ''));

	let cardEl = $state<HTMLElement | null>(null);
	let popoverOpen = $state(false);
	let triggerRect = $state<DOMRect | null>(null);
	let isTouch = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		isTouch = !window.matchMedia('(hover: hover)').matches;
	});

	function showPopover() {
		if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
		triggerRect = cardEl?.getBoundingClientRect() ?? null;
		popoverOpen = true;
	}

	function scheduleHide() {
		hideTimeout = setTimeout(() => { popoverOpen = false; }, 150);
	}

	function handleClick(e: MouseEvent) {
		if (isTouch) {
			e.preventDefault();
			if (popoverOpen) popoverOpen = false;
			else showPopover();
		} else {
			goto(sessionDetailLink(session));
		}
	}
</script>

{#if size === 'compact'}
	<button
		bind:this={cardEl}
		type="button"
		class="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight {color.bg} {color.text} hover:brightness-95"
		onmouseenter={showPopover}
		onmouseleave={scheduleHide}
		onclick={handleClick}
	>
		{session.time ? session.time.slice(0, 5) + ' ' : ''}{session.serviceName ?? 'Session'}
	</button>
{:else}
	<button
		bind:this={cardEl}
		type="button"
		class="mb-0.5 block w-full rounded-lg px-2 py-1.5 text-left ring-1 {color.bg} {color.border} hover:brightness-95"
		onmouseenter={showPopover}
		onmouseleave={scheduleHide}
		onclick={handleClick}
	>
		{#if session.time}
			<p class="text-[10px] font-semibold {color.text}">{session.time.slice(0, 5)}</p>
		{/if}
		<p class="truncate text-[11px] font-medium text-gray-800">
			{session.serviceName ?? 'Session'}{session.firstClientName ? ` · ${session.firstClientName}` : ''}
		</p>
		<div class="flex items-center gap-1.5 text-[10px] text-muted">
			{#if session.totalParticipants > 0}
				<span>{session.totalParticipants} part.</span>
			{/if}
			{#if session.instructors.length > 0}
				{#if session.totalParticipants > 0}<span>·</span>{/if}
				<span class="truncate">{session.instructors.map(i => i.instructorName?.split(' ')[0]).join(', ')}</span>
			{/if}
		</div>
	</button>
{/if}

<Popover open={popoverOpen} {triggerRect} onclose={() => { popoverOpen = false; }}>
	<div onmouseenter={showPopover} onmouseleave={scheduleHide} role="presentation">
		<SessionCardInfo
			serviceName={session.serviceName}
			serviceColor={session.serviceColor}
			time={session.time}
			firstClientName={session.firstClientName}
			totalParticipants={session.totalParticipants}
			bookingStatus={session.bookingStatus}
			date={session.date}
			totalAmountDue={session.totalAmountDue}
			totalAmountPaid={session.totalAmountPaid}
		/>
		<div class="mt-3 flex gap-2">
			<a
				href={sessionDetailLink(session)}
				class="flex-1 rounded-lg bg-ocean py-1.5 text-center text-xs font-semibold text-white hover:bg-ocean/90"
			>
				{m.calendar_view_booking()}
			</a>
			<a
				href="/calendar?view=day&date={session.date}"
				class="flex-1 rounded-lg border border-border py-1.5 text-center text-xs text-muted hover:bg-sand"
			>
				{m.calendar_view_day()}
			</a>
		</div>
	</div>
</Popover>
