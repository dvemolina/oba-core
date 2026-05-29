CREATE TABLE "accommodation_unit_types" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"occupancy_type" text DEFAULT 'private' NOT NULL,
	"max_occupancy" integer DEFAULT 1 NOT NULL,
	"price_per_night" numeric(10, 2) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accommodation_units" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_type_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "accommodation_unit_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guests_count" integer;--> statement-breakpoint
ALTER TABLE "accommodation_unit_types" ADD CONSTRAINT "accommodation_unit_types_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_units" ADD CONSTRAINT "accommodation_units_unit_type_id_accommodation_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."accommodation_unit_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_accommodation_unit_id_accommodation_units_id_fk" FOREIGN KEY ("accommodation_unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE set null ON UPDATE no action;