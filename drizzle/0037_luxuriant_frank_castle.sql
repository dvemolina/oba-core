CREATE TYPE "public"."booking_client_status" AS ENUM('enrolled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('unscheduled', 'scheduled', 'cancelled');--> statement-breakpoint
ALTER TABLE "booking_clients" ALTER COLUMN "status" SET DEFAULT 'enrolled'::"public"."booking_client_status";--> statement-breakpoint
ALTER TABLE "booking_clients" ALTER COLUMN "status" SET DATA TYPE "public"."booking_client_status" USING "status"::"public"."booking_client_status";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'unscheduled'::"public"."session_status";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "status" SET DATA TYPE "public"."session_status" USING "status"::"public"."session_status";