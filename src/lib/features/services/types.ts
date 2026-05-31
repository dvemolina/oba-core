// `type` kept as a cosmetic template label — business logic driven by capability flags.
export type ServiceTemplate = 'lesson' | 'camp' | 'product' | 'rental' | 'accommodation';

// Legacy alias for code that still references ServiceType
export type ServiceType = ServiceTemplate;

export interface Service {
	id: string;
	name: string;
	description: string | null;
	type: ServiceTemplate;
	// ── Capability flags ──────────────────────────────────────────────────────
	hasSessions: boolean;        // needs session scheduling
	hasRoster: boolean;          // multi-client enrollment
	hasDateRange: boolean;       // spans multiple days
	hasInventoryUnits: boolean;  // limited physical units
	requiresInstructor: boolean; // needs guide/instructor
	// ── Config ────────────────────────────────────────────────────────────────
	durationMinutes: number | null;
	basePrice: string;
	startDate: string | null;           // was campStartDate
	endDate: string | null;             // was campEndDate
	maxCapacity: number | null;         // was maxStudents
	defaultInstructorIds: string[] | null; // was campInstructorIds
	color: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateServiceInput {
	name: string;
	description?: string;
	type: ServiceTemplate;
	hasSessions?: boolean;
	hasRoster?: boolean;
	hasDateRange?: boolean;
	hasInventoryUnits?: boolean;
	requiresInstructor?: boolean;
	durationMinutes?: number;
	basePrice: string;
	startDate?: string;
	endDate?: string;
	maxCapacity?: number;
	defaultInstructorIds?: string[];
	color?: string;
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
	active?: boolean;
}
