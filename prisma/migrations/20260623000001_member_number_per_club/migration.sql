-- Remove global autoincrement from Member.number — number is now computed per-club in the API
-- Existing member numbers are preserved; new members get MAX(number)+1 per club

ALTER TABLE "Member" ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Member_number_seq" CASCADE;
