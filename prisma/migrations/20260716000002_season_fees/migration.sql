-- Season: default athlete fee and member quota per season
ALTER TABLE "Season" ADD COLUMN "defaultAthleteMonthlyFee" DOUBLE PRECISION;
ALTER TABLE "Season" ADD COLUMN "defaultMemberMonthlyQuota" DOUBLE PRECISION;

-- Athlete: individual discount percentage (0-100, nullable = no discount)
ALTER TABLE "Athlete" ADD COLUMN "discountPercent" DOUBLE PRECISION;

-- Material: per-season filtering (FK nullable)
ALTER TABLE "Material" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "Material" ADD CONSTRAINT "Material_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Material_seasonId_idx" ON "Material"("seasonId");

-- TextileItem: per-season filtering (FK nullable, separate from existing text "season" field)
ALTER TABLE "TextileItem" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "TextileItem" ADD CONSTRAINT "TextileItem_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TextileItem_seasonId_idx" ON "TextileItem"("seasonId");
