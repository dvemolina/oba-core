BEGIN;

-- 1. Enum
CREATE TYPE session_owner_type AS ENUM ('booking', 'service', 'edition');

-- 2. Add nullable columns to sessions
ALTER TABLE sessions
  ADD COLUMN owner_type         session_owner_type,
  ADD COLUMN booking_id         text REFERENCES bookings(id) ON DELETE CASCADE,
  ADD COLUMN service_id         text REFERENCES services(id) ON DELETE CASCADE,
  ADD COLUMN service_edition_id text REFERENCES service_editions(id) ON DELETE CASCADE;

-- 3. Add session_id to bookings (group class enrollment)
ALTER TABLE bookings ADD COLUMN session_id text REFERENCES sessions(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX idx_sessions_booking_id          ON sessions(booking_id);
CREATE INDEX idx_sessions_service_id          ON sessions(service_id);
CREATE INDEX idx_sessions_service_edition_id  ON sessions(service_edition_id);
CREATE INDEX idx_bookings_session_id          ON bookings(session_id);

-- 5. Detect + delete orphaned sessions (no booking_sessions link)
DO $$
DECLARE orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM sessions s
  WHERE NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.session_id = s.id);
  RAISE NOTICE '[migration] Orphaned sessions to delete: %', orphan_count;
END $$;

DELETE FROM sessions
WHERE NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.session_id = sessions.id);

-- 6. Smart backfill: classify each session by its booking's service modules
UPDATE sessions s
SET
  owner_type = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions')
      THEN 'edition'::session_owner_type
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions') AND b.service_id IS NOT NULL
      THEN 'service'::session_owner_type
    ELSE 'booking'::session_owner_type
  END,
  booking_id = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions') THEN NULL
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions')     THEN NULL
    ELSE primary_link.booking_id
  END,
  service_id = CASE
    WHEN (svc.modules ? 'roster') AND NOT (svc.modules ? 'editions') THEN b.service_id
    ELSE NULL
  END,
  service_edition_id = CASE
    WHEN b.service_edition_id IS NOT NULL AND (svc.modules ? 'editions') THEN b.service_edition_id
    ELSE NULL
  END
FROM (
  SELECT DISTINCT ON (session_id) session_id, booking_id
  FROM booking_sessions ORDER BY session_id, created_at ASC
) AS primary_link
JOIN bookings b ON b.id = primary_link.booking_id
LEFT JOIN services svc ON svc.id = b.service_id
WHERE s.id = primary_link.session_id;

-- 7. Backfill bookings.session_id for group class bookings
UPDATE bookings b
SET session_id = bs.session_id
FROM booking_sessions bs
JOIN sessions s ON s.id = bs.session_id
WHERE bs.booking_id = b.id
  AND s.owner_type = 'service';

-- 8. Abort if any session unclassified
DO $$
DECLARE unclassified integer;
BEGIN
  SELECT COUNT(*) INTO unclassified FROM sessions WHERE owner_type IS NULL;
  IF unclassified > 0 THEN
    RAISE EXCEPTION '[migration] % unclassified sessions — aborting', unclassified;
  END IF;
END $$;

-- 9. Enforce NOT NULL + check constraint
ALTER TABLE sessions ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE sessions ADD CONSTRAINT chk_session_owner CHECK (
  (owner_type = 'booking'  AND booking_id IS NOT NULL          AND service_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'service'  AND service_id IS NOT NULL          AND booking_id IS NULL AND service_edition_id IS NULL) OR
  (owner_type = 'edition'  AND service_edition_id IS NOT NULL  AND booking_id IS NULL AND service_id IS NULL)
);

-- 10. Fix session_participants unique constraint
ALTER TABLE session_participants DROP CONSTRAINT IF EXISTS uq_session_participants_session_name;
DROP INDEX IF EXISTS uq_session_participants_session_name;
CREATE UNIQUE INDEX uq_session_participants_bp
  ON session_participants(session_id, booking_participant_id)
  WHERE booking_participant_id IS NOT NULL;

-- 11. Drop leftover column
ALTER TABLE booking_participants DROP COLUMN IF EXISTS booking_id_temp;

COMMIT;
