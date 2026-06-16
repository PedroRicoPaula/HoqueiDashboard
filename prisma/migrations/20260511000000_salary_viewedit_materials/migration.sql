-- Add salary to DirectionMember
ALTER TABLE "DirectionMember" ADD COLUMN "salary" DOUBLE PRECISION;

-- Replace manageInventory with viewMaterials + editMaterials in Permission
ALTER TABLE "Permission"
  ADD COLUMN "viewMaterials" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "editMaterials" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing manageInventory=true → viewMaterials=true AND editMaterials=true
UPDATE "Permission" SET "viewMaterials" = true, "editMaterials" = true WHERE "manageInventory" = true;

ALTER TABLE "Permission" DROP COLUMN "manageInventory";
