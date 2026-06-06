-- Remove contract-level pricing from inventory — pricing belongs on services, not items.
ALTER TABLE "inventory_item_types" DROP COLUMN IF EXISTS "unit_price";
ALTER TABLE "inventory_item_types" DROP COLUMN IF EXISTS "pricing_unit";
ALTER TABLE "service_inventory_links" DROP COLUMN IF EXISTS "price_override";
