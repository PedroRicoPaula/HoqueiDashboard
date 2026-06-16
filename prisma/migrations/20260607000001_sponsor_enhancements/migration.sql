-- Add sponsor enhancement fields: logo, types, equipment zones, banners, sticks, shinguards
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "sponsorTypes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "equipmentZones" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "bannerCount" INTEGER;
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "includesSticks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sponsor" ADD COLUMN IF NOT EXISTS "includesShinguards" BOOLEAN NOT NULL DEFAULT false;
