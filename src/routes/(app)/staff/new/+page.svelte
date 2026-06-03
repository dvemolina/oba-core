<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto max-w-lg p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/staff" class="text-sm text-muted hover:text-navy">← Staff</a>
		<h1 class="text-xl font-bold text-navy">Invite staff member</h1>
	</div>

	{#if form?.error}
		<p class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{form.error}</p>
	{/if}

	<form method="POST" class="space-y-5">
		<div>
			<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Full name</label>
			<input id="name" name="name" type="text" required class="input w-full" placeholder="Juan García" />
		</div>

		<div>
			<label for="email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
			<input id="email" name="email" type="email" required class="input w-full" placeholder="juan@example.com" />
		</div>

		<div>
			<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">Phone <span class="text-muted">(optional)</span></label>
			<input id="phone" name="phone" type="tel" class="input w-full" placeholder="+34 600 000 000" />
		</div>

		<div>
			<p class="mb-2 block text-sm font-medium text-gray-700">Roles <span class="text-muted">(select all that apply)</span></p>
			<div class="space-y-2">
				{#each [
					{ value: 'instructor', label: 'Instructor', desc: 'Own sessions only' },
					{ value: 'manager',   label: 'Manager',    desc: 'Full operations, no pricing' },
					{ value: 'owner',     label: 'Owner',      desc: 'Full access' },
					{ value: 'admin',     label: 'Admin',      desc: 'Full system access' }
				] as r}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-border hover:bg-sand">
						<input type="checkbox" name="roles" value={r.value} class="h-4 w-4 rounded border-gray-300 text-ocean" />
						<span class="flex-1">
							<span class="text-sm font-medium text-gray-800">{r.label}</span>
							<span class="ml-2 text-xs text-muted">{r.desc}</span>
						</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="rounded-lg bg-sand p-3 text-sm text-muted">
			A temporary password will be generated and emailed to the staff member.
		</div>

		<div class="flex gap-3 pt-2">
			<button type="submit" class="btn-primary">Send invite</button>
			<a href="/staff" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
