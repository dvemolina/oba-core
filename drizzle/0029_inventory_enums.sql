-- ============================================================
-- Migration: add pgEnums for trackingMode/status fields,
--            unique constraint on service_inventory_links,
--            explicit RESTRICT on allocation itemTypeId FK
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "public"."tracking_mode" AS ENUM('pool', 'specific');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."item_status" AS ENUM('available', 'maintenance', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."allocation_status" AS ENUM('allocated', 'returned', 'damaged', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

ALTER TABLE "inventory_item_types" ALTER COLUMN "tracking_mode" DROP DEFAULT;
ALTER TABLE "inventory_item_types" ALTER COLUMN "tracking_mode" TYPE "public"."tracking_mode" USING "tracking_mode"::"public"."tracking_mode";
ALTER TABLE "inventory_item_types" ALTER COLUMN "tracking_mode" SET DEFAULT 'pool';
--> statement-breakpoint

ALTER TABLE "inventory_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "inventory_items" ALTER COLUMN "status" TYPE "public"."item_status" USING "status"::"public"."item_status";
ALTER TABLE "inventory_items" ALTER COLUMN "status" SET DEFAULT 'available';
--> statement-breakpoint

ALTER TABLE "inventory_allocations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "inventory_allocations" ALTER COLUMN "status" TYPE "public"."allocation_status" USING "status"::"public"."allocation_status";
ALTER TABLE "inventory_allocations" ALTER COLUMN "status" SET DEFAULT 'allocated';
--> statement-breakpoint

CREATE UNIQUE INDEX "uq_service_inventory_links" ON "service_inventory_links" USING btree ("service_id", "item_type_id");
--> statement-breakpoint

ALTER TABLE "inventory_allocations"
  DROP CONSTRAINT "inventory_allocations_item_type_id_inventory_item_types_id_fk";
--> statement-breakpoint

ALTER TABLE "inventory_allocations"
  ADD CONSTRAINT "inventory_allocations_item_type_id_inventory_item_types_id_fk"
  FOREIGN KEY ("item_type_id")
  REFERENCES "public"."inventory_item_types"("id")
  ON DELETE restrict ON UPDATE no action;
