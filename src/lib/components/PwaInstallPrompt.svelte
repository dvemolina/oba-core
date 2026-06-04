<script lang="ts">
	import { onMount } from 'svelte';

	const DISMISSED_KEY = 'oba-pwa-dismissed';

	let visible = $state(false);
	let isIOS = $state(false);
	let isMobile = $state(false);
	let deferredPrompt = $state<any>(null);

	onMount(() => {
		// Already installed as PWA — never show
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as any).standalone === true;
		if (isStandalone) return;

		// Already dismissed — never show again
		if (localStorage.getItem(DISMISSED_KEY)) return;

		isMobile = navigator.maxTouchPoints > 0;

		// iOS / iPadOS: no install event, show manual instructions
		isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
			(navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

		if (isIOS) {
			visible = true;
		} else {
			// Chrome / Edge (desktop + Android): intercept install prompt
			window.addEventListener('beforeinstallprompt', (e: Event) => {
				e.preventDefault();
				deferredPrompt = e;
				visible = true;
			});
		}
	});

	function dismiss() {
		localStorage.setItem(DISMISSED_KEY, '1');
		visible = false;
	}

	async function install() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			localStorage.setItem(DISMISSED_KEY, '1');
		}
		visible = false;
	}
</script>

{#if visible}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-50 flex bg-black/40 px-4 {isMobile ? 'items-end pb-6 justify-center' : 'items-center justify-center'}"
		role="dialog" aria-modal="true" aria-label="Install app">

		<div class="w-full max-w-sm rounded-2xl bg-surface shadow-2xl">
			<!-- Handle bar (mobile only) -->
			{#if isMobile}
				<div class="flex justify-center pt-3 pb-1">
					<div class="h-1 w-10 rounded-full bg-border"></div>
				</div>
			{/if}

			<div class="px-6 pb-6 pt-3">
				<!-- Icon + title -->
				<div class="mb-4 flex items-center gap-3">
					<img src="/oba-favicon.png" alt="OBA" class="h-12 w-12 rounded-2xl shadow-sm" />
					<div>
						<p class="text-base font-bold text-navy">Install OBA</p>
						<p class="text-xs text-muted">{isMobile ? 'Add to your home screen' : 'Install as a desktop app'}</p>
					</div>
				</div>

				{#if isIOS}
					<p class="mb-4 text-sm text-gray-700">
						Open the full-screen app — no browser bar, faster access.
					</p>
					<ol class="mb-5 space-y-3">
						<li class="flex items-start gap-3">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-xs font-bold text-ocean">1</span>
							<span class="text-sm text-gray-700">Tap the share button
								<span class="inline-block rounded bg-sand px-1.5 py-0.5 font-mono text-xs">⬆</span>
								in your browser toolbar</span>
						</li>
						<li class="flex items-start gap-3">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-xs font-bold text-ocean">2</span>
							<span class="text-sm text-gray-700">Scroll down and tap <strong>"Add to Home Screen"</strong></span>
						</li>
						<li class="flex items-start gap-3">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-xs font-bold text-ocean">3</span>
							<span class="text-sm text-gray-700">Tap <strong>"Add"</strong> — done!</span>
						</li>
					</ol>
					<button onclick={dismiss}
						class="w-full rounded-xl border border-border py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-sand active:scale-95">
						Got it
					</button>
				{:else}
					<p class="mb-5 text-sm text-gray-700">
						{isMobile ? 'Install OBA for full-screen access — no browser bar, faster loading.' : 'Install OBA as a desktop app — opens in its own window, no browser bar.'}
					</p>
					<button onclick={install}
						class="mb-2 w-full rounded-xl bg-ocean py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean/90 active:scale-95">
						Install app
					</button>
					<button onclick={dismiss}
						class="w-full rounded-xl py-2.5 text-sm text-muted transition-colors hover:text-gray-700">
						Not now
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
