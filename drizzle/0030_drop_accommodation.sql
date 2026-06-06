-- Drop FK on bookings first
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_accommodation_unit_id_accommodation_units_id_fk";

-- Drop columns from bookings
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "accommodation_unit_id";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "guests_count";

-- Drop tables (accommodation_units first because it references accommodation_unit_types)
DROP TABLE IF EXISTS "accommodation_units";
DROP TABLE IF EXISTS "accommodation_unit_types";
