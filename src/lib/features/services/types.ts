// Cosmetic label only — any string is valid. These are suggested presets shown in the UI.
export type ServiceLabel = 'lesson' | 'camp' | 'product' | 'rental' | 'accommodation' | 'other' | (string & {});

// Aliases kept for compatibility
export type ServiceTemplate = ServiceLabel;
export type ServiceType = ServiceLabel;

export type PricingMode =
	| 'flat'
	| 'per_person'
	| 'per_session'
	| 'per_person_per_session'
	| 'per_day'
	| 'per_night'
	| 'per_unit'
	| 'per_unit_per_day'
	| 'per_person_per_day'
	| 'per_hour'      // legacy
	| 'per_half_day'; // legacy

export interface Service {
	id: string;
	name: string;
	description: string | null;
	type: string;
	// ── Capability flags ──────────────────────────────────────────────────────
	hasSessions: boolean;        // needs session scheduling
	hasRoster: boolean;          // multi-client enrollment
	hasDateRange: boolean;       // spans multiple days
	hasInventoryUnits: boolean;  // limited physical units
	requiresInstructor: boolean; // needs guide/instructor
	// ── Config ────────────────────────────────────────────────────────────────
	durationMinutes: number | null;
	defaultSessionsIncluded: number | null;
	basePrice: string;
	pricingMode: PricingMode | null;
	maxCapacity: number | null;
	defaultInstructorIds: string[];
	color: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateServiceInput {
	name: string;
	description?: string;
	type: string;
	hasSessions?: boolean;
	hasRoster?: boolean;
	hasDateRange?: boolean;
	hasInventoryUnits?: boolean;
	requiresInstructor?: boolean;
	durationMinutes?: number;
	defaultSessionsIncluded?: number;
	basePrice: string;
	pricingMode?: PricingMode | null;
	maxCapacity?: number;
	color?: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
