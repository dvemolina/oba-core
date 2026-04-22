ALTER TYPE "public"."service_type" ADD VALUE 'accommodation';--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"whatsapp_id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'IDLE' NOT NULL,
	"service_type" text,
	"collected_data" jsonb,
	"reservation_id" text,
	"language" text DEFAULT 'es',
	"last_activity" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "date_end" date;