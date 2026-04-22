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

// ── Enums ─────────────────────────────────────────────────────────────────────

export const skillLevelEnum = pgEnum('skill_level', ['beginner', 'intermediate', 'advanced']);

export const serviceTypeEnum = pgEnum('service_type', ['lesson', 'camp', 'product', 'rental', 'accommodation']);

export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'cancelled']);

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'partial', 'paid']);

// ── Tables ────────────────────────────────────────────────────────────────────

export const instructors = pgTable('instructors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	phone: text('phone'),
	email: text('email'),
	bio: text('bio'),
	active: boolean('active').notNull().default(true),
	userId: text('user_id'), // nullable FK → auth users table (future instructor login)
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

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
	type: serviceTypeEnum('type').notNull(),
	durationMinutes: integer('duration_minutes'),
	basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const bookings = pgTable('bookings', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	serviceId: text('service_id')
		.notNull()
		.references(() => services.id),
	instructorId: text('instructor_id').references(() => instructors.id),
	date: date('date').notNull(),
	dateEnd: date('date_end'), // check-out date for accommodation; null for single-day services
	time: time('time'),
	isFlexible: boolean('is_flexible').notNull().default(false),
	status: bookingStatusEnum('status').notNull().default('pending'),
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
	amountDue: numeric('amount_due', { precision: 10, scale: 2 }).notNull(),
	amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0'),
	paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending')
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

// Re-export Better Auth schema so db/index.ts imports everything from one place
export * from './auth.schema';
