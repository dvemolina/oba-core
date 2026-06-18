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


/** Add minutes to a HH:MM time string. Returns HH:MM. */
export function addMinutesToTime(time: string, minutes: number): string {
	const [h, m] = time.split(':').map(Number);
	const total = h * 60 + m + minutes;
	const hh = Math.floor(total / 60) % 24;
	const mm = total % 60;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Format a session time range: "09:00 – 10:30" */
export function fmtTimeRange(startTime: string | null, durationMinutes: number): string {
	if (!startTime) return 'Unscheduled';
	const start = startTime.slice(0, 5);
	const end = addMinutesToTime(start, durationMinutes);
	return `${start} – ${end}`;
}

// ── Instructor conflict detection ─────────────────────────────────────────────

/** Minimal shape needed to run conflict checks — satisfied by SessionForDay and AgendaSession. */
export interface SessionLike {
	id: string;
	date: string;
	time: string | null;
	status: string;
	effectiveDuration: number;
	instructors: { instructorId: string; instructorName?: string | null }[];
	serviceName: string | null;
	bookingStatus: string | null;
}

export interface InstructorConflict {
	instructorId: string;
	conflictingSessionId: string;
	serviceName: string | null;
	startTime: string;         // HH:MM
	endTime: string;           // HH:MM calculated
	bookingStatus: string | null;     // affects visual severity
}

/**
 * Returns conflicts for a single instructor: sessions where that instructor
 * is already assigned and the time window overlaps the proposed window.
 */
export function checkInstructorConflicts(
	instructorId: string,
	date: string,
	startTime: string,
	durationMinutes: number,
	sessions: SessionLike[],
	excludeSessionId?: string
): InstructorConflict[] {
	const [sh, sm] = startTime.split(':').map(Number);
	const startMins = sh * 60 + sm;
	const endMins = startMins + durationMinutes;

	return sessions
		.filter(s => {
			if (s.id === excludeSessionId) return false;
			if (s.date !== date) return false;
			if (!s.time || s.status === 'cancelled') return false;
			if (!s.instructors.some(i => i.instructorId === instructorId)) return false;
			const [sth, stm] = s.time.split(':').map(Number);
			const sStart = sth * 60 + stm;
			const sEnd = sStart + s.effectiveDuration;
			// Overlap: neither ends before the other starts
			return startMins < sEnd && endMins > sStart;
		})
		.map(s => ({
			instructorId,
			conflictingSessionId: s.id,
			serviceName: s.serviceName,
			startTime: s.time!.slice(0, 5),
			endTime: addMinutesToTime(s.time!.slice(0, 5), s.effectiveDuration),
			bookingStatus: s.bookingStatus
		}));
}

/** Check all instructors in one call. Returns map of instructorId → conflicts. */
export function checkAllInstructorConflicts(
	instructorIds: string[],
	date: string,
	startTime: string,
	durationMinutes: number,
	sessions: SessionLike[],
	excludeSessionId?: string
): Record<string, InstructorConflict[]> {
	const result: Record<string, InstructorConflict[]> = {};
	if (!startTime || !durationMinutes) return result;
	for (const id of instructorIds) {
		const conflicts = checkInstructorConflicts(id, date, startTime, durationMinutes, sessions, excludeSessionId);
		if (conflicts.length > 0) result[id] = conflicts;
	}
	return result;
}
