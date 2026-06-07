import { goto } from '$app/navigation';
import { toast } from '$lib/stores/toast.svelte';

/**
 * Reusable enhance callback factory for SvelteKit forms.
 * Shows success toast, handles deletion redirect, shows error toast on failure.
 */
export function withToast(onSuccess?: () => void) {
	return () =>
		async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				if (result.data?.message) toast(result.data.message);
				if (result.data?.cancelled) { await goto('/calendar'); return; }
				if (result.data?.deleted) { await goto('/bookings'); return; }
				onSuccess?.();
				await update();
			} else if (result.type === 'failure') {
				if (result.data?.error) toast(result.data.error, 'error');
				await update();
			}
		};
}
