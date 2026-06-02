<script lang="ts">
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
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
			<label for="role" class="mb-1 block text-sm font-medium text-gray-700">Role</label>
			<select id="role" name="role" class="input w-full">
				<option value="instructor">Instructor — own sessions only</option>
				<option value="manager">Manager — full operations, no pricing</option>
				<option value="owner">Owner — full access</option>
			</select>
		</div>

		{#if data.unlinkedProfiles.length > 0}
			<div>
				<label for="instructorProfileId" class="mb-1 block text-sm font-medium text-gray-700">
					Link to instructor profile <span class="text-muted">(optional)</span>
				</label>
				<select id="instructorProfileId" name="instructorProfileId" class="input w-full">
					<option value="">— none —</option>
					{#each data.unlinkedProfiles as profile}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-muted">Only unlinked instructor profiles are shown</p>
			</div>
		{/if}

		<div class="rounded-lg bg-sand p-3 text-sm text-muted">
			A temporary password will be generated and emailed to the staff member.
		</div>

		<div class="flex gap-3 pt-2">
			<button type="submit" class="btn-primary">Send invite</button>
			<a href="/staff" class="btn-secondary">Cancel</a>
		</div>
	</form>
</div>
