<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Login — OBA</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-sand px-4">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="mb-2 text-5xl">🏄</div>
			<h1 class="text-2xl font-bold text-navy">OBA</h1>
			<p class="mt-1 text-sm text-muted">Surf School Manager</p>
		</div>

		<!-- Card -->
		<div class="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm ring-1 ring-border">
			<h2 class="mb-6 text-lg font-semibold text-gray-800">Sign in</h2>

			<form
				method="post"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						update();
					};
				}}
				class="space-y-4"
			>
				<div>
					<label for="email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
					<input
						id="email"
						type="email"
						name="email"
						required
						autocomplete="email"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:ring-2 focus:ring-ocean/20 focus:outline-none"
						placeholder="owner@oba.surf"
					/>
				</div>

				<div>
					<label for="password" class="mb-1 block text-sm font-medium text-gray-700">
						Password
					</label>
					<input
						id="password"
						type="password"
						name="password"
						required
						autocomplete="current-password"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:ring-2 focus:ring-ocean/20 focus:outline-none"
					/>
				</div>

				{#if form?.error}
					<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean/90 disabled:opacity-60"
				>
					{loading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	</div>
</div>
