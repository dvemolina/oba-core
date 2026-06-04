<script lang="ts">
	import { Zap } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	let {
		index,
		total,
		instructors,
		date = $bindable(''),
		time = $bindable(''),
		isFlexible = $bindable(false),
		skillLevel = $bindable<'beginner' | 'intermediate' | 'advanced' | ''>(''),
		instructorIds = $bindable<string[]>([])
	}: {
		index: number;
		total: number;
		instructors: Array<{ id: string; name: string }>;
		date?: string;
		time?: string;
		isFlexible?: boolean;
		skillLevel?: 'beginner' | 'intermediate' | 'advanced' | '';
		instructorIds?: string[];
	} = $props();

	const levels = [
		{ value: 'beginner', label: () => m.skill_level_beginner() },
		{ value: 'intermediate', label: () => m.skill_level_intermediate() },
		{ value: 'advanced', label: () => m.skill_level_advanced() }
	] as const;

	function toggleInstructor(id: string) {
		instructorIds = instructorIds.includes(id)
			? instructorIds.filter((x) => x !== id)
			: [...instructorIds, id];
	}
</script>

<div class="space-y-3">
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_detail_session_date()}
			</label>
			<input
				type="date"
				name="sessionDate[{index}]"
				bind:value={date}
				required
				class="input w-full"
			/>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_detail_session_time()}
			</label>
			<div class="flex items-center gap-2">
				<input
					type="time"
					name="sessionTime[{index}]"
					bind:value={time}
					disabled={isFlexible}
					class="input flex-1 disabled:opacity-40"
				/>
				<button
					type="button"
					onclick={() => (isFlexible = !isFlexible)}
					title={m.booking_new_flexible()}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border {isFlexible ? 'border-ocean bg-ocean/10 text-ocean' : 'border-border text-muted'}"
				>
					<Zap class="h-4 w-4" />
				</button>
			</div>
			<input type="hidden" name="sessionFlexible[{index}]" value={isFlexible ? 'on' : ''} />
		</div>
	</div>

	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_level()} <span class="font-normal normal-case text-muted">(optional)</span>
		</label>
		<div class="flex gap-2">
			{#each levels as lvl}
				<button
					type="button"
					onclick={() => (skillLevel = skillLevel === lvl.value ? '' : lvl.value)}
					class="flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors
						{skillLevel === lvl.value
						? 'border-ocean bg-ocean/10 text-ocean'
						: 'border-border text-muted hover:border-ocean/40'}"
				>
					{lvl.label()}
				</button>
			{/each}
		</div>
		<input type="hidden" name="sessionLevel[{index}]" value={skillLevel} />
	</div>

	{#if instructors.length > 0}
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
				{m.booking_new_instructor()}
			</label>
			<div class="flex flex-wrap gap-2">
				{#each instructors as inst}
					<label class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs
						{instructorIds.includes(inst.id) ? 'border-ocean bg-ocean/10 text-ocean' : 'border-border text-gray-600'}">
						<input
							type="checkbox"
							name="sessionInstructor[{index}][]"
							value={inst.id}
							checked={instructorIds.includes(inst.id)}
							onchange={() => toggleInstructor(inst.id)}
							class="sr-only"
						/>
						{inst.name}
					</label>
				{/each}
			</div>
		</div>
	{/if}
</div>
