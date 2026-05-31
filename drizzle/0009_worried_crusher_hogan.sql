-- Service capability flags: replacing hardcoded type-based logic with flexible boolean flags.
-- Column renames make naming domain-agnostic (camp* → generic).

-- 1. Add capability flag columns
ALTER TABLE "services" ADD COLUMN "has_sessions" boolean NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "has_roster" boolean NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "has_date_range" boolean NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "has_inventory_units" boolean NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "requires_instructor" boolean NOT NULL DEFAULT true;

-- 2. Rename columns to domain-agnostic names
ALTER TABLE "services" RENAME COLUMN "camp_start_date" TO "start_date";
ALTER TABLE "services" RENAME COLUMN "camp_end_date" TO "end_date";
ALTER TABLE "services" RENAME COLUMN "max_students" TO "max_capacity";
ALTER TABLE "services" RENAME COLUMN "camp_instructor_ids" TO "default_instructor_ids";

-- 3. Set capability flags from existing type values
UPDATE "services" SET
  has_sessions        = (type IN ('lesson', 'camp')),
  has_roster          = (type = 'camp'),
  has_date_range      = (type IN ('camp', 'accommodation')),
  has_inventory_units = (type IN ('accommodation', 'rental')),
  requires_instructor = (type IN ('lesson', 'camp'));
