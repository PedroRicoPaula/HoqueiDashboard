-- Add trainerAgeGroups if not present (migration 001 was skip-resolved on production)
ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "trainerAgeGroups" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate role TEXT → roles TEXT[] if needed
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DirectionMember' AND column_name = 'role'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DirectionMember' AND column_name = 'roles'
  ) THEN
    ALTER TABLE "DirectionMember" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT '{}';
    UPDATE "DirectionMember" SET "roles" = ARRAY[role] WHERE role IS NOT NULL AND role <> '';
    ALTER TABLE "DirectionMember" DROP COLUMN "role";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DirectionMember' AND column_name = 'roles'
  ) THEN
    ALTER TABLE "DirectionMember" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
