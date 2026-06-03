-- ============================================================
-- Migration: service_instructors junction table + DB indexes
-- ============================================================

-- Step 1: Create service_instructors junction table
CREATE TABLE IF NOT EXISTS service_instructors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Step 2: Migrate existing JSONB values → junction rows
-- default_instructor_ids already contains user IDs (updated by migration 0023)
INSERT INTO service_instructors (service_id, user_id)
SELECT
  s.id AS service_id,
  elem.uid AS user_id
FROM services s,
     jsonb_array_elements_text(s.default_instructor_ids::jsonb) AS elem(uid)
WHERE s.default_instructor_ids IS NOT NULL
  AND jsonb_typeof(s.default_instructor_ids::jsonb) = 'array'
  AND jsonb_array_length(s.default_instructor_ids::jsonb) > 0
  AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = elem.uid)
ON CONFLICT DO NOTHING;

-- Step 3: Drop the JSONB column
ALTER TABLE services DROP COLUMN IF EXISTS default_instructor_ids;

-- Step 4: Indexes on service_instructors
CREATE INDEX IF NOT EXISTS idx_service_instructors_service ON service_instructors(service_id);
CREATE INDEX IF NOT EXISTS idx_service_instructors_user ON service_instructors(user_id);

-- Step 5: Indexes on bookings
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id);

-- Step 6: Indexes on booking_clients
CREATE INDEX IF NOT EXISTS idx_booking_clients_booking ON booking_clients(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_clients_client ON booking_clients(client_id);

-- Step 7: Indexes on sessions (surf school sessions, not auth sessions)
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Step 8: Indexes on booking_sessions
CREATE INDEX IF NOT EXISTS idx_booking_sessions_session ON booking_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_sessions_booking ON booking_sessions(booking_id);

-- Step 9: Indexes on session_instructors
CREATE INDEX IF NOT EXISTS idx_session_instructors_session ON session_instructors(session_id);
CREATE INDEX IF NOT EXISTS idx_session_instructors_user ON session_instructors(user_id);

-- Step 10: Indexes on booking_instructors
CREATE INDEX IF NOT EXISTS idx_booking_instructors_booking ON booking_instructors(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_instructors_user ON booking_instructors(user_id);
