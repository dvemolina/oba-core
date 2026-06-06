-- ============================================================
-- Migration: add pricing_unit enum + inventory tables
-- ============================================================

CREATE TYPE "public"."pricing_unit" AS ENUM('per_hour', 'per_half_day', 'per_day', 'per_night', 'per_session', 'flat');
--> statement-breakpoint

CREATE TABLE "inventory_item_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tracking_mode" text DEFAULT 'pool' NOT NULL,
	"total_pool_size" integer,
	"attribute_schema" jsonb DEFAULT '{}' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"pricing_unit" "pricing_unit" DEFAULT 'per_day' NOT NULL,
	"capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"item_type_id" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "service_inventory_links" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"item_type_id" text NOT NULL,
	"quantity_per_booking" integer DEFAULT 1 NOT NULL,
	"is_included" boolean DEFAULT true NOT NULL,
	"price_override" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "inventory_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"item_type_id" text NOT NULL,
	"item_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"attribute_filter" jsonb,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'allocated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_item_type_id_inventory_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."inventory_item_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_inventory_links" ADD CONSTRAINT "service_inventory_links_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "service_inventory_links" ADD CONSTRAINT "service_inventory_links_item_type_id_inventory_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."inventory_item_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_item_type_id_inventory_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."inventory_item_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "idx_inventory_items_type" ON "inventory_items" USING btree ("item_type_id");
--> statement-breakpoint

CREATE INDEX "idx_service_inventory_links_service" ON "service_inventory_links" USING btree ("service_id");
--> statement-breakpoint

CREATE INDEX "idx_service_inventory_links_item_type" ON "service_inventory_links" USING btree ("item_type_id");
--> statement-breakpoint

CREATE INDEX "idx_inventory_allocations_booking" ON "inventory_allocations" USING btree ("booking_id");
--> statement-breakpoint

CREATE INDEX "idx_inventory_allocations_item_type" ON "inventory_allocations" USING btree ("item_type_id");
--> statement-breakpoint

CREATE INDEX "idx_inventory_allocations_item" ON "inventory_allocations" USING btree ("item_id");
--> statement-breakpoint

CREATE INDEX "idx_inventory_allocations_dates" ON "inventory_allocations" USING btree ("start_date", "end_date");
