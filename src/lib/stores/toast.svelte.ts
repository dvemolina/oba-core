export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
}

let _toasts = $state<ToastItem[]>([]);

export const toasts = {
	get list() { return _toasts; }
};

export function toast(message: string, type: ToastType = 'success', duration = 3500) {
	const id = crypto.randomUUID();
	_toasts = [..._toasts, { id, message, type }];
	setTimeout(() => dismiss(id), duration);
}

export function dismiss(id: string) {
	_toasts = _toasts.filter(t => t.id !== id);
}
