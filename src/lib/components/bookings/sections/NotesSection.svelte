<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let {
		spotNotes = $bindable(''),
		notes = $bindable('')
	}: {
		spotNotes?: string;
		notes?: string;
	} = $props();
</script>

<div class="space-y-3">
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_spot_notes()}
		</label>
		<input
			type="text"
			name="spotNotes"
			bind:value={spotNotes}
			placeholder={m.booking_new_spot_placeholder()}
			class="input w-full"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
			{m.booking_new_internal_notes()}
		</label>
		<textarea
			name="notes"
			bind:value={notes}
			rows="2"
			class="input w-full resize-none"
		></textarea>
	</div>
</div>
