-- Preserve existing instructor assignments: migrate to booking_instructors junction
INSERT INTO booking_instructors (id, booking_id, instructor_id)
SELECT gen_random_uuid()::text, id, instructor_id
FROM bookings
WHERE instructor_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "bookings" DROP COLUMN "instructor_id";
