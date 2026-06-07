-- Idempotent migration: pricing_mode system
-- Works whether coming from pricing_unit column or fresh

-- 1. Create pricing_mode enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE "public"."pricing_mode" AS ENUM(
    'flat','per_person','per_session','per_person_per_session',
    'per_day','per_night','per_unit','per_unit_per_day',
    'per_person_per_day','per_hour','per_half_day'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- 2. Convert services.type from service_type enum to text (if still enum)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='services' AND column_name='type' AND udt_name='service_type'
  ) THEN
    ALTER TABLE "services" ALTER COLUMN "type" TYPE text USING type::text;
    ALTER TABLE "services" ALTER COLUMN "type" SET DEFAULT 'other';
  END IF;
END $$;--> statement-breakpoint

-- 3. Add pricing_mode column to services (skip if exists)
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "pricing_mode" "pricing_mode";--> statement-breakpoint

-- 4. Migrate data from pricing_unit column if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='services' AND column_name='pricing_unit'
  ) THEN
    UPDATE "services"
    SET "pricing_mode" = "pricing_unit"::text::"pricing_mode"
    WHERE "pricing_unit" IS NOT NULL AND "pricing_mode" IS NULL;
    ALTER TABLE "services" DROP COLUMN "pricing_unit";
  END IF;
END $$;--> statement-breakpoint

-- 5. Drop old enum types (CASCADE handles any remaining column dependencies)
DROP TYPE IF EXISTS "public"."pricing_unit" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."service_type" CASCADE;--> statement-breakpoint

-- 6. Add addon fields to service_inventory_links
ALTER TABLE "service_inventory_links" ADD COLUMN IF NOT EXISTS "addon_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_inventory_links" ADD COLUMN IF NOT EXISTS "addon_pricing_mode" "pricing_mode";--> statement-breakpoint
ALTER TABLE "service_inventory_links" ADD COLUMN IF NOT EXISTS "is_optional" boolean NOT NULL DEFAULT true;
