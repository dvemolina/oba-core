// Cosmetic label only — any string is valid. These are suggested presets shown in the UI.
export type ServiceLabel = 'lesson' | 'camp' | 'product' | 'rental' | 'accommodation' | 'other' | (string & {});

export type ServicePricingUnit = 'per_hour' | 'per_half_day' | 'per_day' | 'per_night' | 'per_session' | 'flat';

// Aliases kept for compatibility
export type ServiceTemplate = ServiceLabel;
export type ServiceType = ServiceLabel;

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
	defaultSessionsIncluded: number | null; // default sessions per booking (1, 5, 10, etc.)
	basePrice: string;
	pricingUnit: ServicePricingUnit | null;
	maxCapacity: number | null;
	defaultInstructorIds: string[];     // fetched from service_instructors junction table
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
	pricingUnit?: ServicePricingUnit | null;
	maxCapacity?: number;
	color?: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
