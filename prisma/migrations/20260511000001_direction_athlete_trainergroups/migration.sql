-- Convert trainerAgeGroup (String?) to trainerAgeGroups (String[])
ALTER TABLE "DirectionMember" ADD COLUMN "trainerAgeGroups" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "DirectionMember"
  SET "trainerAgeGroups" = ARRAY["trainerAgeGroup"]::TEXT[]
  WHERE "trainerAgeGroup" IS NOT NULL;
ALTER TABLE "DirectionMember" DROP COLUMN "trainerAgeGroup";

-- Add optional link to Senior Athlete (one-to-one)
ALTER TABLE "DirectionMember" ADD COLUMN "athleteId" TEXT;
CREATE UNIQUE INDEX "DirectionMember_athleteId_key" ON "DirectionMember"("athleteId");
ALTER TABLE "DirectionMember" ADD CONSTRAINT "DirectionMember_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
