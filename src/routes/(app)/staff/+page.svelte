<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const ROLE_COLORS: Record<string, string> = {
		admin:      'bg-red-100 text-red-700',
		owner:      'bg-ocean/10 text-ocean',
		manager:    'bg-purple-100 text-purple-700',
		instructor: 'bg-green-100 text-green-700'
	};

	const ROLE_LABELS: Record<string, string> = {
		admin: 'Admin', owner: 'Owner', manager: 'Manager', instructor: 'Instructor'
	};
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Staff</h1>
		<a href="/staff/new" class="btn-primary btn-sm">+ Invite staff</a>
	</div>

	<div class="space-y-2">
		{#each data.staff as member}
			<a
				href="/staff/{member.id}"
				class="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-lg font-bold text-ocean">
					{member.name[0].toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-1.5">
						<p class="font-medium text-gray-800">{member.name}</p>
						{#each (member.roles?.length ? member.roles : member.role ? [member.role] : []) as r}
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-600'}">
								{ROLE_LABELS[r] ?? r}
							</span>
						{/each}
						{#if member.banned}
							<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">banned</span>
						{/if}
					</div>
					<p class="text-xs text-muted">{member.email}</p>
				</div>
			</a>
		{/each}
	</div>

	{#if data.staff.length === 0}
		<p class="py-12 text-center text-sm text-muted">No staff yet.</p>
	{/if}
</div>
