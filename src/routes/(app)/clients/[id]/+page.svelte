<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);
	let loading = $state(false);
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/clients" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<div>
			<h1 class="text-xl font-bold text-navy">
				{data.client.firstName}
				{data.client.lastName}
			</h1>
			{#if data.client.skillLevel}
				<span class="text-xs text-muted">{data.client.skillLevel}</span>
			{/if}
		</div>
		<div class="ml-auto flex items-center gap-2">
			<button
				onclick={() => (editing = !editing)}
				class="btn-ghost btn-sm"
			>
				{editing ? 'Cancel' : 'Edit'}
			</button>
			<form
				method="post"
				action="?/delete"
				use:enhance
				onsubmit={(e) => { if (!confirm(`Delete ${data.client.firstName} ${data.client.lastName}? This cannot be undone.`)) e.preventDefault(); }}
			>
				<button
					type="submit"
					class="btn-destructive btn-sm"
				>
					Delete
				</button>
			</form>
		</div>
	</div>

	{#if editing}
		<form
			method="post"
			action="?/update"
			class="mb-8 space-y-4"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					editing = false;
					update();
				};
			}}
		>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">First name</label>
					<input
						name="firstName"
						required
						value={data.client.firstName}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">Last name</label>
					<input
						name="lastName"
						required
						value={data.client.lastName}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
					/>
				</div>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
				<input
					name="phone"
					type="tel"
					value={data.client.phone ?? ''}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
				<input
					name="email"
					type="email"
					value={data.client.email ?? ''}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
				<input
					name="nationality"
					value={data.client.nationality ?? ''}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Skill level</label>
				<select
					name="skillLevel"
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				>
					<option value="">— not set —</option>
					{#each ['beginner', 'intermediate', 'advanced'] as level}
						<option value={level} selected={data.client.skillLevel === level}>{level}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
				<textarea
					name="notes"
					rows="2"
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-ocean focus:outline-none"
				>{data.client.notes ?? ''}</textarea>
			</div>
			{#if form?.error}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{form.error}</p>
			{/if}
			<button
				type="submit"
				disabled={loading}
				class="btn-primary btn-block"
			>
				{loading ? 'Saving…' : 'Save Changes'}
			</button>
		</form>
	{:else}
		<div class="mb-6 space-y-2 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border">
			{#if data.client.phone}<p class="text-sm">📞 {data.client.phone}</p>{/if}
			{#if data.client.email}<p class="text-sm">✉️ {data.client.email}</p>{/if}
			{#if data.client.nationality}<p class="text-sm">🌍 {data.client.nationality}</p>{/if}
			{#if data.client.notes}<p class="text-sm text-muted">{data.client.notes}</p>{/if}
			{#if !data.client.phone && !data.client.email && !data.client.nationality && !data.client.notes}
				<p class="text-sm text-muted">No contact info yet.</p>
			{/if}
		</div>
	{/if}

	<!-- Booking history -->
	<h2 class="mb-3 text-sm font-semibold text-gray-700">Bookings ({data.bookings.length})</h2>
	{#if data.bookings.length === 0}
		<p class="text-sm text-muted">No bookings yet.</p>
	{:else}
		<div class="space-y-2">
			{#each data.bookings as booking}
				<a
					href="/bookings/{booking.id}"
					class="flex items-center justify-between rounded-lg bg-surface p-3 ring-1 ring-border hover:ring-ocean/50"
				>
					<div>
						<p class="text-sm font-medium">{booking.date}{booking.time ? ` · ${booking.time}` : ''}</p>
						<p class="text-xs text-muted">{booking.serviceName}</p>
					</div>
					<span
						class="rounded-full px-2 py-0.5 text-xs {booking.status === 'confirmed'
							? 'bg-green-100 text-green-700'
							: booking.status === 'cancelled'
								? 'bg-red-100 text-red-700'
								: 'bg-amber-100 text-amber-700'}"
					>
						{booking.status}
					</span>
				</a>
			{/each}
		</div>
	{/if}
</div>
