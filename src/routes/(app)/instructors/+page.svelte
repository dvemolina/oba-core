<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-navy">Instructors</h1>
		<a href="/instructors/new" class="btn-primary btn-sm">
			+ New
		</a>
	</div>

	<div class="space-y-2">
		{#each data.instructors as instructor}
			<a
				href="/instructors/{instructor.id}"
				class="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-border hover:ring-ocean/50"
			>
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean/10 text-lg font-bold text-ocean">
					{instructor.name[0].toUpperCase()}
				</div>
				<div class="min-w-0 flex-1">
					<p class="font-medium text-gray-800 {!instructor.active ? 'opacity-50' : ''}">
						{instructor.name}
					</p>
					{#if instructor.phone}
						<p class="text-xs text-muted">{instructor.phone}</p>
					{/if}
				</div>
				{#if !instructor.active}
					<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted">inactive</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if data.instructors.length === 0}
		<p class="py-12 text-center text-sm text-muted">No instructors yet.</p>
	{/if}
</div>
