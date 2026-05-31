-- Sessions system: Booking → Session separation.
-- sessions = physical occurrences (when it actually happens, who teaches)
-- booking = the contract (who enrolled, what they paid, how many)

CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "time" time,
  "notes" text,
  "status" text NOT NULL DEFAULT 'unscheduled',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "session_instructors" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "instructor_id" text NOT NULL REFERENCES "instructors"("id") ON DELETE CASCADE
);

CREATE TABLE "booking_instructors" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "instructor_id" text NOT NULL REFERENCES "instructors"("id") ON DELETE CASCADE
);

-- Indexes for common lookups
CREATE INDEX "sessions_booking_id_idx" ON "sessions" ("booking_id");
CREATE INDEX "sessions_date_idx" ON "sessions" ("date");
CREATE INDEX "session_instructors_session_id_idx" ON "session_instructors" ("session_id");
CREATE UNIQUE INDEX "session_instructors_unique" ON "session_instructors" ("session_id", "instructor_id");
CREATE UNIQUE INDEX "booking_instructors_unique" ON "booking_instructors" ("booking_id", "instructor_id");

-- Data migration: create 1 session per existing lesson/camp booking
-- Lesson bookings with time → scheduled session; without → unscheduled
INSERT INTO "sessions" ("id", "booking_id", "date", "time", "status", "sort_order", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  b.id,
  b.date,
  b.time,
  CASE WHEN b.time IS NOT NULL THEN 'scheduled' ELSE 'unscheduled' END,
  0,
  now(),
  now()
FROM "bookings" b
JOIN "services" s ON b.service_id = s.id
WHERE s.has_sessions = true
  AND b.status != 'cancelled';

-- Migrate existing instructor assignments to session_instructors
INSERT INTO "session_instructors" ("id", "session_id", "instructor_id")
SELECT
  gen_random_uuid()::text,
  ses.id,
  b.instructor_id
FROM "sessions" ses
JOIN "bookings" b ON ses.booking_id = b.id
WHERE b.instructor_id IS NOT NULL;
