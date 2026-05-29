ALTER TABLE "booking_clients" ADD COLUMN "status" text DEFAULT 'enrolled' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_clients" ADD COLUMN "cancelled_at" timestamp;