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

/** Returns the Monday of the week containing the given date string. */
export function getWeekStart(dateStr: string): Date {
	const d = new Date(dateStr + 'T00:00:00');
	const dow = d.getDay(); // 0=Sun
	const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
	d.setDate(d.getDate() + diff);
	return d;
}

/** Returns an array of 7 date strings (Mon–Sun) for the week containing dateStr. */
export function getWeekDays(weekStart: Date): string[] {
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + i);
		return formatDate(d);
	});
}

export function getDateRange(
	view: 'month' | 'week' | 'agenda',
	year: number,
	month: number,
	weekStart?: string
): { from: string; to: string } {
	if (view === 'week' && weekStart) {
		const start = getWeekStart(weekStart);
		const end = new Date(start);
		end.setDate(end.getDate() + 6);
		return { from: formatDate(start), to: formatDate(end) };
	}
	if (view === 'month') {
		const days = getDaysInMonth(year, month);
		const m = String(month).padStart(2, '0');
		return {
			from: `${year}-${m}-01`,
			to: `${year}-${m}-${String(days).padStart(2, '0')}`
		};
	}
	// agenda: next 90 days
	const today = new Date();
	const future = new Date(today);
	future.setDate(future.getDate() + 90);
	return { from: formatDate(today), to: formatDate(future) };
}

export function getTodayString(): string {
	return formatDate(new Date());
}
