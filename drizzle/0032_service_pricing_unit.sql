-- Add pricingUnit to services — contract-level billing unit for inventory services.
-- Nullable: only populated when hasInventoryUnits = true.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "pricing_unit" "pricing_unit";
