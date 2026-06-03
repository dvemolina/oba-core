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
	jsonb,
	index
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
	hasSessions: boolean('has_sessions').notNull().default(false),
	hasRoster: boolean('has_roster').notNull().default(false),
	hasDateRange: boolean('has_date_range').notNull().default(false),
	hasInventoryUnits: boolean('has_inventory_units').notNull().default(false),
	requiresInstructor: boolean('requires_instructor').notNull().default(true),
	// ── Type-specific config ──────────────────────────────────────────────────
	durationMinutes: integer('duration_minutes'),
	defaultSessionsIncluded: integer('default_sessions_included'),
	basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
	maxCapacity: integer('max_capacity'),
	color: text('color').notNull().default('ocean'),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Default instructors for a service — proper junction table replacing the old JSONB column.
// Cascade deletes: removing a service or user cleans up automatically.
export const serviceInstructors = pgTable('service_instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [
	index('idx_service_instructors_service').on(t.serviceId),
	index('idx_service_instructors_user').on(t.userId)
]);

export const serviceRuns = pgTable('service_runs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id, { onDelete: 'cascade' }),
	startDate: date('start_date').notNull(),
	endDate: date('end_date').notNull(),
	maxCapacity: integer('max_capacity'),
	notes: text('notes'),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => [
	index('idx_service_runs_service').on(t.serviceId),
	index('idx_service_runs_dates').on(t.startDate, t.endDate)
]);

export const bookings = pgTable('bookings', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.references(() => services.id),
	date: date('date').notNull(),
	dateEnd: date('date_end'),
	serviceRunId: text('service_run_id')
		.references(() => serviceRuns.id, { onDelete: 'set null' }),
	accommodationUnitId: text('accommodation_unit_id')
		.references(() => accommodationUnits.id, { onDelete: 'set null' }),
	guestsCount: integer('guests_count'),
	time: time('time'),
	sessionsIncluded: integer('sessions_included'),
	isFlexible: boolean('is_flexible').notNull().default(false),
	status: bookingStatusEnum('status').notNull().default('pending'),
	source: text('source').notNull().default('admin'),
	spotNotes: text('spot_notes'),
	notes: text('notes'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => [
	index('idx_bookings_date').on(t.date),
	index('idx_bookings_status').on(t.status),
	index('idx_bookings_service').on(t.serviceId),
	index('idx_bookings_service_run').on(t.serviceRunId)
]);

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
	status: text('status').notNull().default('enrolled'),
	amountDue: numeric('amount_due', { precision: 10, scale: 2 }).notNull(),
	amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0'),
	paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
	cancelledAt: timestamp('cancelled_at')
}, (t) => [
	index('idx_booking_clients_booking').on(t.bookingId),
	index('idx_booking_clients_client').on(t.clientId)
]);

export const accommodationUnitTypes = pgTable('accommodation_unit_types', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
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
	status: text('status').notNull().default('available'),
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
	// TODO: wire up as bookable entities — needs client enrollment, payments, email notifications
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

export const sessions = pgTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	date: date('date').notNull(),
	time: time('time'),
	durationMinutes: integer('duration_minutes'),
	notes: text('notes'),
	status: text('status').notNull().default('unscheduled'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => [
	index('idx_sessions_date').on(t.date),
	index('idx_sessions_status').on(t.status)
]);

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
}, (t) => [
	index('idx_booking_sessions_session').on(t.sessionId),
	index('idx_booking_sessions_booking').on(t.bookingId)
]);

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
}, (t) => [
	index('idx_session_instructors_session').on(t.sessionId),
	index('idx_session_instructors_user').on(t.instructorId)
]);

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
}, (t) => [
	index('idx_booking_instructors_booking').on(t.bookingId),
	index('idx_booking_instructors_user').on(t.instructorId)
]);

// Re-export Better Auth schema so db/index.ts imports everything from one place
export * from './auth.schema';
