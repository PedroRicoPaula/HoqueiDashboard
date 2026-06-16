-- Remove logoUrl from Sponsor (logos not used)
ALTER TABLE "Sponsor" DROP COLUMN IF EXISTS "logoUrl";
