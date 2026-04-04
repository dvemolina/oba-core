import { describe, it, expect } from 'vitest';
import { groupBookingsByDate, getDaysInMonth, formatDate, getDateRange } from './utils';

describe('groupBookingsByDate', () => {
	it('groups bookings by their date string', () => {
		const bookings = [
			{ id: '1', date: '2025-04-10', time: '10:00', status: 'confirmed' },
			{ id: '2', date: '2025-04-10', time: '14:00', status: 'pending' },
			{ id: '3', date: '2025-04-11', time: '09:00', status: 'confirmed' }
		] as any;

		const grouped = groupBookingsByDate(bookings);
		expect(Object.keys(grouped)).toHaveLength(2);
		expect(grouped['2025-04-10']).toHaveLength(2);
		expect(grouped['2025-04-11']).toHaveLength(1);
	});
});

describe('getDaysInMonth', () => {
	it('returns 30 days for April 2025', () => {
		expect(getDaysInMonth(2025, 4)).toBe(30);
	});

	it('returns 28 days for February 2025 (non-leap)', () => {
		expect(getDaysInMonth(2025, 2)).toBe(28);
	});

	it('returns 29 days for February 2024 (leap)', () => {
		expect(getDaysInMonth(2024, 2)).toBe(29);
	});
});

describe('formatDate', () => {
	it('formats a date to YYYY-MM-DD', () => {
		expect(formatDate(new Date(2025, 3, 10))).toBe('2025-04-10');
	});
});

describe('getDateRange', () => {
	it('returns start and end of month', () => {
		const { from, to } = getDateRange('month', 2025, 4);
		expect(from).toBe('2025-04-01');
		expect(to).toBe('2025-04-30');
	});
});
