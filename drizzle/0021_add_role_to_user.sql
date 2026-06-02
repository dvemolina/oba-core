ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;

UPDATE "user" SET "role" = 'admin' WHERE "email" = 'dvemolina@gmail.com';
UPDATE "user" SET "role" = 'owner' WHERE "email" IN ('crisesteve1503@gmail.com', 'patripaucastello@gmail.com');
