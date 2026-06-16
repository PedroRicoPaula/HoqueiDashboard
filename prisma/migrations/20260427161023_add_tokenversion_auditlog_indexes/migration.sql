-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Athlete_name_idx" ON "Athlete"("name");

-- CreateIndex
CREATE INDEX "Athlete_ageGroup_idx" ON "Athlete"("ageGroup");

-- CreateIndex
CREATE INDEX "DirectionMember_name_idx" ON "DirectionMember"("name");

-- CreateIndex
CREATE INDEX "Material_state_idx" ON "Material"("state");

-- CreateIndex
CREATE INDEX "Material_category_idx" ON "Material"("category");

-- CreateIndex
CREATE INDEX "Material_athleteId_idx" ON "Material"("athleteId");

-- CreateIndex
CREATE INDEX "Member_name_idx" ON "Member"("name");

-- CreateIndex
CREATE INDEX "Quota_memberId_year_idx" ON "Quota"("memberId", "year");

-- CreateIndex
CREATE INDEX "Sponsor_name_idx" ON "Sponsor"("name");

-- CreateIndex
CREATE INDEX "Sponsor_contractEnd_idx" ON "Sponsor"("contractEnd");

-- CreateIndex
CREATE INDEX "Training_date_idx" ON "Training"("date");

-- CreateIndex
CREATE INDEX "Travel_departureDate_idx" ON "Travel"("departureDate");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
