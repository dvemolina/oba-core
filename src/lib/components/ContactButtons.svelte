<script lang="ts">
	import { Phone, MessageCircle, Mail } from 'lucide-svelte';

	let {
		phone = null,
		email = null,
		whatsappMessage = '',
		compact = false
	}: {
		phone?: string | null;
		email?: string | null;
		whatsappMessage?: string;
		compact?: boolean;
	} = $props();

	const waUrl = $derived(
		phone
			? `https://wa.me/${phone.replace(/[\s\-\(\)\+]/g, '')}${whatsappMessage ? '?text=' + encodeURIComponent(whatsappMessage) : ''}`
			: ''
	);

	const hasAny = $derived(!!(phone || email));
</script>

{#if compact}
	<!-- Icon-only mode: show all available -->
	<div class="flex items-center gap-1">
		{#if phone}
			<a href="tel:{phone}"
				class="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition-colors hover:bg-sky-200"
				title="Llamar {phone}">
				<Phone size={14} strokeWidth={1.75} />
			</a>
			<a href={waUrl}
				target="_blank" rel="noopener noreferrer"
				class="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500 text-white transition-colors hover:bg-green-600"
				title="WhatsApp">
				<MessageCircle size={14} strokeWidth={1.75} />
			</a>
		{/if}
		{#if email}
			<a href="mailto:{email}"
				class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
				title="{email}">
				<Mail size={14} strokeWidth={1.75} />
			</a>
		{/if}
	</div>
{:else if hasAny}
	<!-- Full labeled buttons: show all available -->
	<div class="flex gap-2">
		{#if phone}
			<a href="tel:{phone}" class="btn-secondary btn-sm flex-1 gap-1.5">
				<Phone size={14} strokeWidth={1.75} />
				Call
			</a>
			<a href={waUrl}
				target="_blank" rel="noopener noreferrer"
				class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-600">
				<MessageCircle size={14} strokeWidth={1.75} />
				WhatsApp
			</a>
		{/if}
		{#if email}
			<a href="mailto:{email}" class="btn-secondary btn-sm flex-1 gap-1.5">
				<Mail size={14} strokeWidth={1.75} />
				Email
			</a>
		{/if}
	</div>
{:else}
	<p class="text-xs text-muted italic">Sin información de contacto.</p>
{/if}
