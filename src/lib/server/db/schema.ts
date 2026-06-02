import {
	pgTable,
	pgEnum,
	text,
	timestamp,
	boolean,
	numeric,
	integer,
	date,
	time,
	jsonb
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const skillLevelEnum = pgEnum('skill_level', ['beginner', 'intermediate', 'advanced']);

export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'cancelled']);

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'partial', 'paid']);

// ── Tables ────────────────────────────────────────────────────────────────────

export const clients = pgTable('clients', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	phone: text('phone'),
	email: text('email'),
	nationality: text('nationality'),
	skillLevel: skillLevelEnum('skill_level'),
	notes: text('notes'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const services = pgTable('services', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	// `type` kept as a display template hint — business logic now driven by capability flags below
	type: text('type').notNull().default('other'),
	// ── Capability flags ──────────────────────────────────────────────────────
	hasSessions: boolean('has_sessions').notNull().default(false),       // needs session scheduling (lessons, classes, tours)
	hasRoster: boolean('has_roster').notNull().default(false),           // multi-client enrollment (camps, group classes)
	hasDateRange: boolean('has_date_range').notNull().default(false),    // spans multiple days (camps, stays, expeditions)
	hasInventoryUnits: boolean('has_inventory_units').notNull().default(false), // limited physical units (rooms, gear, boards)
	requiresInstructor: boolean('requires_instructor').notNull().default(true), // needs guide/instructor assigned
	// ── Type-specific config (kept for backward compat, reused across templates) ──
	durationMinutes: integer('duration_minutes'),        // default session duration in minutes
	defaultSessionsIncluded: integer('default_sessions_included'), // default sessions per booking (e.g. 1, 5, 10)
	basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
	startDate: date('start_date'),             // was campStartDate
	endDate: date('end_date'),                 // was campEndDate
	maxCapacity: integer('max_capacity'),      // was maxStudents — max clients per booking/roster
	defaultInstructorIds: jsonb('default_instructor_ids'), // was campInstructorIds — suggested instructors
	color: text('color').notNull().default('ocean'),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const bookings = pgTable('bookings', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.references(() => services.id),
	date: date('date').notNull(),
	dateEnd: date('date_end'),
	accommodationUnitId: text('accommodation_unit_id')
		.references(() => accommodationUnits.id, { onDelete: 'set null' }),
	guestsCount: integer('guests_count'),
	time: time('time'),
	sessionsIncluded: integer('sessions_included'), // how many sessions were sold (null = not a sessions-based booking)
	isFlexible: boolean('is_flexible').notNull().default(false),
	status: bookingStatusEnum('status').notNull().default('pending'),
	source: text('source').notNull().default('admin'),
	spotNotes: text('spot_notes'),
	notes: text('notes'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const bookingClients = pgTable('booking_clients', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	bookingId: text('booking_id')
		.notNull()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	clientId: text('client_id')
		.notNull()
		.references(() => clients.id),
	status: text('status').notNull().default('enrolled'), // 'enrolled' | 'cancelled'
	amountDue: numeric('amount_due', { precision: 10, scale: 2 }).notNull(),
	amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0'),
	paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
	cancelledAt: timestamp('cancelled_at')
});

export const accommodationUnitTypes = pgTable('accommodation_unit_types', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	// 'shared' = strangers co-book individual beds, 'private' = whole room per booking, 'entire' = full property
	occupancyType: text('occupancy_type').notNull().default('private'),
	maxOccupancy: integer('max_occupancy').notNull().default(1),
	pricePerNight: numeric('price_per_night', { precision: 10, scale: 2 }).notNull(),
	description: text('description'),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const accommodationUnits = pgTable('accommodation_units', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	unitTypeId: text('unit_type_id')
		.notNull()
		.references(() => accommodationUnitTypes.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	status: text('status').notNull().default('available'), // 'available' | 'maintenance'
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const events = pgTable('events', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	description: text('description'),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	serviceId: text('service_id').references(() => services.id),
	price: numeric('price', { precision: 10, scale: 2 }),
	notes: text('notes'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const whatsappSessions = pgTable('whatsapp_sessions', {
	whatsappId:    text('whatsapp_id').primaryKey(),
	state:         text('state').notNull().default('IDLE'),
	serviceType:   text('service_type'),
	collectedData: jsonb('collected_data'),
	reservationId: text('reservation_id'),
	language:      text('language').default('es'),
	lastActivity:  timestamp('last_activity').notNull().defaultNow()
});

// ── Sessions ──────────────────────────────────────────────────────────────────
// Physical occurrences of a service. Independent of any single booking —
// multiple bookings can be linked to the same session via booking_sessions.
// Applies to any service with has_sessions=true.

export const sessions = pgTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	date: date('date').notNull(),
	time: time('time'),                          // null = unscheduled
	durationMinutes: integer('duration_minutes'), // null = use service default
	notes: text('notes'),                        // spot info, group description, etc.
	status: text('status').notNull().default('unscheduled'), // 'unscheduled' | 'scheduled' | 'completed' | 'cancelled'
	sortOrder: integer('sort_order').notNull().default(0), // ordering within same day
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Junction: links sessions to bookings (many-to-many).
// A session can serve clients from multiple bookings (group lessons, shared sessions).
// A booking can have multiple sessions (lesson packages, multi-day camps).
export const bookingSessions = pgTable('booking_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	bookingId: text('booking_id')
		.notNull()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const sessionInstructors = pgTable('session_instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	instructorId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const sessionParticipants = pgTable('session_participants', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	notes: text('notes'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

// Multiple instructors on non-session bookings (rentals, products, accommodation)
export const bookingInstructors = pgTable('booking_instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	bookingId: text('booking_id')
		.notNull()
		.references(() => bookings.id, { onDelete: 'cascade' }),
	instructorId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

// Re-export Better Auth schema so db/index.ts imports everything from one place
export * from './auth.schema';
