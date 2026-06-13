-- Migration: module system schema
-- Replaces boolean feature flags on services with a JSONB `modules` column,
-- renames service_runs → service_editions, and moves participant/credit fields
-- from bookings → booking_clients; adds booking_client_id to booking_participants.

-- ── 1. services: drop boolean flags, add modules JSONB ────────────────────────

ALTER TABLE "services" DROP COLUMN IF EXISTS "has_sessions";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN IF EXISTS "has_roster";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN IF EXISTS "has_date_range";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN IF EXISTS "has_inventory_units";--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN IF EXISTS "requires_instructor";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "modules" jsonb NOT NULL DEFAULT '{}';--> statement-breakpoint

-- ── 2. service_runs → service_editions ───────────────────────────────────────

-- Drop FK from bookings that references service_runs before rename
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_service_run_id_fkey";--> statement-breakpoint

-- Rename the table
ALTER TABLE "service_runs" RENAME TO "service_editions";--> statement-breakpoint

-- Rename primary key constraint
ALTER INDEX IF EXISTS "service_runs_pkey" RENAME TO "service_editions_pkey";--> statement-breakpoint

-- Rename indexes
DROP INDEX IF EXISTS "idx_service_runs_service";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_service_runs_dates";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_editions_service" ON "service_editions"("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_service_editions_dates" ON "service_editions"("start_date", "end_date");--> statement-breakpoint

-- Rename FK constraint on service_editions itself
ALTER TABLE "service_editions" DROP CONSTRAINT IF EXISTS "service_runs_service_id_fkey";--> statement-breakpoint
ALTER TABLE "service_editions" ADD CONSTRAINT "service_editions_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE;--> statement-breakpoint

-- ── 3. bookings: rename service_run_id → service_edition_id, drop participant_count ──

ALTER TABLE "bookings" RENAME COLUMN "service_run_id" TO "service_edition_id";--> statement-breakpoint

-- Re-add FK pointing to renamed table
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_edition_id_fkey"
  FOREIGN KEY ("service_edition_id") REFERENCES "service_editions"("id") ON DELETE SET NULL;--> statement-breakpoint

-- Rename index
DROP INDEX IF EXISTS "idx_bookings_service_run";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_service_edition" ON "bookings"("service_edition_id");--> statement-breakpoint

-- Drop participant_count from bookings (moving to booking_clients)
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "participant_count";--> statement-breakpoint

-- ── 4. booking_clients: add new columns ──────────────────────────────────────

ALTER TABLE "booking_clients" ADD COLUMN IF NOT EXISTS "participant_count" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "booking_clients" ADD COLUMN IF NOT EXISTS "credit_source_id" text;--> statement-breakpoint
ALTER TABLE "booking_clients" ADD COLUMN IF NOT EXISTS "credit_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "booking_clients" ADD COLUMN IF NOT EXISTS "price_override" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "booking_clients" ADD COLUMN IF NOT EXISTS "override_reason" text;--> statement-breakpoint

-- Add FK for credit_source_id → bookings.id
ALTER TABLE "booking_clients" ADD CONSTRAINT "booking_clients_credit_source_id_bookings_id_fk"
  FOREIGN KEY ("credit_source_id") REFERENCES "bookings"("id");--> statement-breakpoint

-- ── 5. booking_participants: add booking_client_id, make booking_id nullable ─

-- Drop existing NOT NULL constraint and FK on booking_id
ALTER TABLE "booking_participants" DROP CONSTRAINT IF EXISTS "booking_participants_booking_id_fkey";--> statement-breakpoint

-- Rename booking_id → booking_id_temp (kept for migration script)
ALTER TABLE "booking_participants" RENAME COLUMN "booking_id" TO "booking_id_temp";--> statement-breakpoint

-- Make booking_id_temp nullable
ALTER TABLE "booking_participants" ALTER COLUMN "booking_id_temp" DROP NOT NULL;--> statement-breakpoint

-- Add booking_client_id column
ALTER TABLE "booking_participants" ADD COLUMN IF NOT EXISTS "booking_client_id" text;--> statement-breakpoint

-- Add FK for booking_client_id
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_client_id_fkey"
  FOREIGN KEY ("booking_client_id") REFERENCES "booking_clients"("id") ON DELETE CASCADE;--> statement-breakpoint

-- Rename index
DROP INDEX IF EXISTS "idx_booking_participants_booking";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_participants_booking_client" ON "booking_participants"("booking_client_id");--> statement-breakpoint
