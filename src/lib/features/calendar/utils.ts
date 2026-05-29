// src/lib/features/calendar/utils.ts
import type { BookingSummary } from '$lib/features/bookings/types';

export function groupBookingsByDate(
	bookings: BookingSummary[]
): Record<string, BookingSummary[]> {
	return bookings.reduce<Record<string, BookingSummary[]>>((acc, b) => {
		const end = b.dateEnd ?? b.date;
		let current = b.date;
		while (current <= end) {
			(acc[current] ??= []).push(b);
			const d = new Date(current + 'T00:00:00');
			d.setDate(d.getDate() + 1);
			current = formatDate(d);
		}
		return acc;
	}, {});
}

export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function getDateRange(
	view: 'month' | 'week' | 'agenda',
	year: number,
	month: number
): { from: string; to: string } {
	if (view === 'month') {
		const days = getDaysInMonth(year, month);
		const m = String(month).padStart(2, '0');
		return {
			from: `${year}-${m}-01`,
			to: `${year}-${m}-${String(days).padStart(2, '0')}`
		};
	}
	// agenda: next 60 days from today
	const today = new Date();
	const future = new Date(today);
	future.setDate(future.getDate() + 60);
	return { from: formatDate(today), to: formatDate(future) };
}

export function getTodayString(): string {
	return formatDate(new Date());
}
