-- Drop the enum constraint on services.type, convert to plain text.
-- Type is a cosmetic label only — business logic is driven by capability flags.
-- Existing 'custom' values (were rejected by old enum, so none exist in practice).

ALTER TABLE "services" ALTER COLUMN "type" TYPE text USING type::text;
ALTER TABLE "services" ALTER COLUMN "type" SET DEFAULT 'other';
DROP TYPE IF EXISTS "service_type";
