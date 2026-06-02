-- ============================================================
-- Migration: remove instructors table, users are instructors
-- ============================================================

-- Step 1: Add profile columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;

-- Step 2: Copy profile data from instructors → users (linked records)
UPDATE "user" u
SET
  phone  = COALESCE(i.phone, u.phone),
  bio    = COALESCE(i.bio, u.bio),
  active = i.active
FROM instructors i
WHERE i.user_id = u.id;

-- Step 3: Create user records for orphaned instructors (no user_id)
-- Reuse the instructor's id as the user id — preserves all FK values in junction tables
INSERT INTO "user" (id, name, email, "email_verified", "created_at", "updated_at", role, roles, active, phone, bio)
SELECT
  i.id,
  i.name,
  CASE
    WHEN i.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "user" u2 WHERE u2.email = i.email)
    THEN i.email
    ELSE 'pending_' || i.id || '@setup.oba'
  END,
  false,
  i.created_at,
  i.updated_at,
  'instructor',
  ARRAY['instructor']::text[],
  i.active,
  i.phone,
  i.bio
FROM instructors i
WHERE i.user_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 4: In session_instructors, update instructor_id → user_id value
-- For linked instructors: point to their user account
UPDATE session_instructors si
SET instructor_id = i.user_id
FROM instructors i
WHERE si.instructor_id = i.id AND i.user_id IS NOT NULL;
-- (orphaned instructors already have instructor.id == new user.id — no update needed)

-- Step 5: Drop FK, rename column, add new FK in session_instructors
ALTER TABLE session_instructors DROP CONSTRAINT IF EXISTS session_instructors_instructor_id_fkey;
ALTER TABLE session_instructors RENAME COLUMN instructor_id TO user_id;
ALTER TABLE session_instructors ADD CONSTRAINT session_instructors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Step 6: Same for booking_instructors
UPDATE booking_instructors bi
SET instructor_id = i.user_id
FROM instructors i
WHERE bi.instructor_id = i.id AND i.user_id IS NOT NULL;

ALTER TABLE booking_instructors DROP CONSTRAINT IF EXISTS booking_instructors_instructor_id_fkey;
ALTER TABLE booking_instructors RENAME COLUMN instructor_id TO user_id;
ALTER TABLE booking_instructors ADD CONSTRAINT booking_instructors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Step 7: Migrate services.default_instructor_ids
-- Replace each instructor.id → user.id (or instructor.id itself if orphaned, which equals new user.id)
UPDATE services s
SET default_instructor_ids = (
  SELECT jsonb_agg(COALESCE(i.user_id, i.id))
  FROM jsonb_array_elements_text(s.default_instructor_ids::jsonb) AS elem(iid)
  JOIN instructors i ON i.id = elem.iid
)
WHERE default_instructor_ids IS NOT NULL
  AND jsonb_typeof(default_instructor_ids::jsonb) = 'array'
  AND jsonb_array_length(default_instructor_ids::jsonb) > 0;

-- Step 8: Drop the instructors table
DROP TABLE IF EXISTS instructors;
