-- Migration: Add explicit clubId to AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord
-- These models previously relied on implicit tenant isolation via parent relations.
-- Adding clubId makes isolation explicit and allows the Prisma Extension to auto-filter them.

-- ─── AthletePayment ───────────────────────────────────────────────────────────
ALTER TABLE "AthletePayment" ADD COLUMN "clubId" TEXT;

UPDATE "AthletePayment" ap
SET "clubId" = a."clubId"
FROM "Athlete" a
WHERE ap."athleteId" = a."id";

ALTER TABLE "AthletePayment" ALTER COLUMN "clubId" SET NOT NULL;

ALTER TABLE "AthletePayment"
  ADD CONSTRAINT "AthletePayment_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AthletePayment_clubId_idx" ON "AthletePayment"("clubId");

-- ─── Quota ────────────────────────────────────────────────────────────────────
ALTER TABLE "Quota" ADD COLUMN "clubId" TEXT;

UPDATE "Quota" q
SET "clubId" = m."clubId"
FROM "Member" m
WHERE q."memberId" = m."id";

ALTER TABLE "Quota" ALTER COLUMN "clubId" SET NOT NULL;

ALTER TABLE "Quota"
  ADD CONSTRAINT "Quota_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Quota_clubId_idx" ON "Quota"("clubId");

-- ─── DirectionSalaryPayment ───────────────────────────────────────────────────
ALTER TABLE "DirectionSalaryPayment" ADD COLUMN "clubId" TEXT;

UPDATE "DirectionSalaryPayment" dsp
SET "clubId" = dm."clubId"
FROM "DirectionMember" dm
WHERE dsp."memberId" = dm."id";

ALTER TABLE "DirectionSalaryPayment" ALTER COLUMN "clubId" SET NOT NULL;

ALTER TABLE "DirectionSalaryPayment"
  ADD CONSTRAINT "DirectionSalaryPayment_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DirectionSalaryPayment_clubId_idx" ON "DirectionSalaryPayment"("clubId");

-- ─── AttendanceRecord ─────────────────────────────────────────────────────────
ALTER TABLE "AttendanceRecord" ADD COLUMN "clubId" TEXT;

UPDATE "AttendanceRecord" ar
SET "clubId" = ts."clubId"
FROM "TrainingSession" ts
WHERE ar."sessionId" = ts."id";

ALTER TABLE "AttendanceRecord" ALTER COLUMN "clubId" SET NOT NULL;

ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AttendanceRecord_clubId_idx" ON "AttendanceRecord"("clubId");
