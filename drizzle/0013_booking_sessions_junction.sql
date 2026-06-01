-- Decouple sessions from single bookings: replace booking_id FK with a
-- many-to-many junction table so a session can serve multiple bookings
-- (group lessons, shared sessions) and a booking can own multiple sessions.

-- 1. Create junction table
CREATE TABLE "booking_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 2. Add FK constraints
ALTER TABLE "booking_sessions"
	ADD CONSTRAINT "booking_sessions_session_id_sessions_id_fk"
	FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_sessions"
	ADD CONSTRAINT "booking_sessions_booking_id_bookings_id_fk"
	FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 3. Unique constraint: each session+booking pair is linked at most once
ALTER TABLE "booking_sessions"
	ADD CONSTRAINT "booking_sessions_session_id_booking_id_unique"
	UNIQUE ("session_id", "booking_id");
--> statement-breakpoint

-- 4. Migrate existing session→booking relationships into the junction table
INSERT INTO "booking_sessions" ("id", "session_id", "booking_id")
SELECT gen_random_uuid(), "id", "booking_id"
FROM "sessions"
WHERE "booking_id" IS NOT NULL;
--> statement-breakpoint

-- 5. Drop booking_id from sessions (now tracked via junction)
ALTER TABLE "sessions" DROP COLUMN "booking_id";
