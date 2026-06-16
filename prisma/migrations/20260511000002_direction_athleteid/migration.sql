-- Add optional link from DirectionMember to a Senior Athlete (one-to-one)
ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "athleteId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DirectionMember_athleteId_key" ON "DirectionMember"("athleteId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DirectionMember_athleteId_fkey'
  ) THEN
    ALTER TABLE "DirectionMember" ADD CONSTRAINT "DirectionMember_athleteId_fkey"
      FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
