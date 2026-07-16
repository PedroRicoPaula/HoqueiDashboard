-- Migration: Season feature (épocas desportivas)
-- Adds Season model and seasonId (nullable FK) to Member, Sponsor, AthletePayment, Quota.
-- Changes Member unique from (clubId, number) to (clubId, number, seasonId).
-- In PostgreSQL, NULLs are treated as distinct in unique indexes, so existing rows
-- (all with seasonId = NULL) do NOT violate the new constraint.

-- ─── Season table ─────────────────────────────────────────────────────────────
CREATE TABLE "Season" (
    "id"        TEXT NOT NULL,
    "clubId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Season"
    ADD CONSTRAINT "Season_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Season_clubId_name_key"      ON "Season"("clubId", "name");
CREATE INDEX        "Season_clubId_idx"            ON "Season"("clubId");
CREATE INDEX        "Season_clubId_isActive_idx"   ON "Season"("clubId", "isActive");

-- ─── seasonId on Member ────────────────────────────────────────────────────────
ALTER TABLE "Member" ADD COLUMN "seasonId" TEXT;

ALTER TABLE "Member"
    ADD CONSTRAINT "Member_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace old unique (clubId, number) with (clubId, number, seasonId)
DROP INDEX IF EXISTS "Member_clubId_number_key";
CREATE UNIQUE INDEX "Member_clubId_number_seasonId_key" ON "Member"("clubId", "number", "seasonId");

CREATE INDEX "Member_seasonId_idx" ON "Member"("seasonId");

-- ─── seasonId on Sponsor ──────────────────────────────────────────────────────
ALTER TABLE "Sponsor" ADD COLUMN "seasonId" TEXT;

ALTER TABLE "Sponsor"
    ADD CONSTRAINT "Sponsor_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sponsor_seasonId_idx" ON "Sponsor"("seasonId");

-- ─── seasonId on AthletePayment ───────────────────────────────────────────────
ALTER TABLE "AthletePayment" ADD COLUMN "seasonId" TEXT;

ALTER TABLE "AthletePayment"
    ADD CONSTRAINT "AthletePayment_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AthletePayment_seasonId_idx" ON "AthletePayment"("seasonId");

-- ─── seasonId on Quota ────────────────────────────────────────────────────────
ALTER TABLE "Quota" ADD COLUMN "seasonId" TEXT;

ALTER TABLE "Quota"
    ADD CONSTRAINT "Quota_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Quota_seasonId_idx" ON "Quota"("seasonId");
