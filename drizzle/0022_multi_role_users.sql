ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "roles" text[];

UPDATE "user" SET "roles" = ARRAY["role"] WHERE "role" IS NOT NULL AND "roles" IS NULL;
