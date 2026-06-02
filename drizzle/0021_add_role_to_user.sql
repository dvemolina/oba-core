ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" timestamp;

UPDATE "user" SET "role" = 'admin' WHERE "email" = 'dvemolina@gmail.com';
UPDATE "user" SET "role" = 'owner' WHERE "email" IN ('crisesteve1503@gmail.com', 'patripaucastello@gmail.com');
