-- 1. booking_participants: add payment tracking columns
ALTER TABLE "booking_participants"
  ADD COLUMN "amount_paid" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_status" "payment_status" NOT NULL DEFAULT 'pending';

-- 2. inventory_allocations: add per-participant FK
ALTER TABLE "inventory_allocations"
  ADD COLUMN "booking_participant_id" text
    REFERENCES "booking_participants"("id") ON DELETE SET NULL;
CREATE INDEX "idx_inventory_allocations_participant"
  ON "inventory_allocations"("booking_participant_id");

-- 3. session_participants: add paid flag
ALTER TABLE "session_participants"
  ADD COLUMN "paid" boolean NOT NULL DEFAULT false;

-- 4. booking_clients: enforce 1 enrolled client per booking
-- Partial index: only blocks duplicates where status = 'enrolled'
-- Cancelled rows are unaffected so historical data is preserved
CREATE UNIQUE INDEX "uq_booking_clients_booking"
  ON "booking_clients"("booking_id")
  WHERE status = 'enrolled';
