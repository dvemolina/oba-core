-- ============================================================
-- Migration: service_runs table — reusable service templates
-- ============================================================

-- Step 1: Create service_runs table
CREATE TABLE IF NOT EXISTS service_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_capacity INTEGER,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_runs_service ON service_runs(service_id);
CREATE INDEX IF NOT EXISTS idx_service_runs_dates ON service_runs(start_date, end_date);

-- Step 2: Migrate existing services with dates → create a run per service
INSERT INTO service_runs (service_id, start_date, end_date, max_capacity, created_at, updated_at)
SELECT id, start_date, end_date, max_capacity, created_at, updated_at
FROM services
WHERE start_date IS NOT NULL AND end_date IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Add service_run_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_run_id TEXT REFERENCES service_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service_run ON bookings(service_run_id);

-- Step 4: Link existing bookings to their run
-- Match booking to run by service + booking.date = run.start_date
UPDATE bookings b
SET service_run_id = sr.id
FROM service_runs sr
WHERE b.service_id = sr.service_id
  AND b.date = sr.start_date;

-- Step 5: Drop start_date / end_date from services (now in service_runs)
ALTER TABLE services DROP COLUMN IF EXISTS start_date;
ALTER TABLE services DROP COLUMN IF EXISTS end_date;
