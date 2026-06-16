ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "sectionistAgeGroups" TEXT[] NOT NULL DEFAULT '{}';
