<script lang="ts">
	import ServiceForm from '$lib/components/services/ServiceForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="p-4 md:p-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/services" class="btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-lg p-0">←</a>
		<h1 class="text-xl font-semibold text-navy">Nuevo servicio</h1>
	</div>

	<ServiceForm
		instructors={data.instructors}
		allItemTypes={data.allItemTypes}
		formError={form?.error ?? null}
		formValues={form?.values ?? null}
	/>
</div>
