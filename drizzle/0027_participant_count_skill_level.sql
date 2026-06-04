ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "participant_count" integer;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "skill_level" skill_level;
