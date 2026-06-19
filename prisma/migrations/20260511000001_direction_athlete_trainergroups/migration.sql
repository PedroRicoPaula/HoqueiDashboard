-- Convert trainerAgeGroup (String?) to trainerAgeGroups (String[])
ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "trainerAgeGroups" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate data only if source column exists (safe for fresh installs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'DirectionMember' AND column_name = 'trainerAgeGroup') THEN
    UPDATE "DirectionMember"
      SET "trainerAgeGroups" = ARRAY["trainerAgeGroup"]::TEXT[]
      WHERE "trainerAgeGroup" IS NOT NULL;
    ALTER TABLE "DirectionMember" DROP COLUMN "trainerAgeGroup";
  END IF;
END $$;

-- Add optional link to Senior Athlete (one-to-one)
ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "athleteId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DirectionMember_athleteId_key" ON "DirectionMember"("athleteId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'DirectionMember_athleteId_fkey') THEN
    ALTER TABLE "DirectionMember" ADD CONSTRAINT "DirectionMember_athleteId_fkey"
      FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
