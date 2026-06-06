-- Add price_override to bookings — allows overriding the service base price at booking level.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "price_override" numeric(10, 2);
