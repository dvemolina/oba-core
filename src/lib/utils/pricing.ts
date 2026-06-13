import type { PricingMode } from '$lib/features/services/types';
import { defaultPricingModeForModules } from '$lib/features/services/modules';
export type { ServiceModules } from '$lib/features/services/modules';

export type { PricingMode };

export interface PricingDimensions {
	participants?: number;
	sessions?: number;
	days?: number;
	units?: number;
}

/**
 * Calculate booking amount for a given pricing mode.
 * Each dimension defaults to 1 so flat or partial modes still work.
 */
export function calculateAmount(
	basePrice: number,
	mode: PricingMode | null | undefined,
	dims: PricingDimensions = {}
): number {
	const p = Math.max(1, dims.participants ?? 1);
	const s = Math.max(1, dims.sessions ?? 1);
	const d = Math.max(1, dims.days ?? 1);
	const u = Math.max(1, dims.units ?? 1);

	switch (mode) {
		case 'flat':                   return basePrice;
		case 'per_person':             return basePrice * p;
		case 'per_session':            return basePrice * s;
		case 'per_person_per_session': return basePrice * p * s;
		case 'per_day':                return basePrice * d;
		case 'per_night':              return basePrice * d;
		case 'per_unit':               return basePrice * u;
		case 'per_unit_per_day':       return basePrice * u * d;
		case 'per_person_per_day':     return basePrice * p * d;
		case 'per_hour':               return basePrice; // legacy — treat as flat
		case 'per_half_day':           return basePrice; // legacy — treat as flat
		default:                       return basePrice;
	}
}

/** Human-readable formula: "€30 × 3 people × 2 sessions = €180" */
export function fmtPricingFormula(
	basePrice: string,
	mode: PricingMode | null | undefined,
	dims: PricingDimensions = {}
): string {
	const p = dims.participants ?? 1;
	const s = dims.sessions ?? 1;
	const d = dims.days ?? 1;
	const u = dims.units ?? 1;

	const parts: string[] = [`€${basePrice}`];

	switch (mode) {
		case 'per_person':             parts.push(`${p} person${p !== 1 ? 's' : ''}`); break;
		case 'per_session':            parts.push(`${s} session${s !== 1 ? 's' : ''}`); break;
		case 'per_person_per_session': parts.push(`${p} person${p !== 1 ? 's' : ''}`, `${s} session${s !== 1 ? 's' : ''}`); break;
		case 'per_day':                parts.push(`${d} day${d !== 1 ? 's' : ''}`); break;
		case 'per_night':              parts.push(`${d} night${d !== 1 ? 's' : ''}`); break;
		case 'per_unit':               parts.push(`${u} unit${u !== 1 ? 's' : ''}`); break;
		case 'per_unit_per_day':       parts.push(`${u} unit${u !== 1 ? 's' : ''}`, `${d} day${d !== 1 ? 's' : ''}`); break;
		case 'per_person_per_day':     parts.push(`${p} person${p !== 1 ? 's' : ''}`, `${d} day${d !== 1 ? 's' : ''}`); break;
	}

	const total = calculateAmount(parseFloat(basePrice), mode, dims);
	return `${parts.join(' × ')} = €${total.toFixed(2)}`;
}

/** Returns billable participant count after subtracting credited participants. */
export function billableParticipants(enrollment: { participantCount: number; creditCount: number }): number {
	return Math.max(0, enrollment.participantCount - enrollment.creditCount)
}

// Replace old defaultPricingMode — callers now pass ServiceModules instead of boolean flags
export { defaultPricingModeForModules as defaultPricingMode };

/** All pricing modes with display labels for UI selects. */
export const PRICING_MODE_OPTIONS: { value: PricingMode; label: string; hint: string }[] = [
	{ value: 'flat',                   label: 'Flat price',                hint: 'Fixed total regardless of people or time' },
	{ value: 'per_person',             label: 'Per person',                hint: '× number of participants' },
	{ value: 'per_session',            label: 'Per session',               hint: '× number of sessions' },
	{ value: 'per_person_per_session', label: 'Per person × per session',  hint: '× people × sessions (group lessons)' },
	{ value: 'per_day',                label: 'Per day',                   hint: '× number of days' },
	{ value: 'per_night',              label: 'Per night',                 hint: '× number of nights (accommodation)' },
	{ value: 'per_unit',               label: 'Per unit',                  hint: '× quantity of items' },
	{ value: 'per_unit_per_day',       label: 'Per unit × per day',        hint: '× items × days (equipment rental)' },
	{ value: 'per_person_per_day',     label: 'Per person × per day',      hint: '× people × days (multi-day camp)' },
];

/** Whether this mode needs a date-range to be meaningful. */
export function modeNeedsDateRange(mode: PricingMode | null | undefined): boolean {
	return mode === 'per_day' || mode === 'per_night' || mode === 'per_unit_per_day' || mode === 'per_person_per_day';
}
