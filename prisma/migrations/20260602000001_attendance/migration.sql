-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC');

-- AlterTable Permission: add attendance + textiles flags
ALTER TABLE "Permission"
  ADD COLUMN IF NOT EXISTS "viewAttendance" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "editAttendance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "viewTextiles"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "editTextiles"   BOOLEAN NOT NULL DEFAULT false;

-- CreateTable TrainingSession
CREATE TABLE "TrainingSession" (
    "id"              TEXT NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "time"            TEXT,
    "primaryAgeGroup" "AgeGroup" NOT NULL,
    "sessionType"     "SessionType" NOT NULL DEFAULT 'GENERAL',
    "title"           TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable AttendanceRecord
CREATE TABLE "AttendanceRecord" (
    "id"        TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "present"   BOOLEAN NOT NULL DEFAULT false,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSession_date_idx" ON "TrainingSession"("date");
CREATE INDEX "TrainingSession_primaryAgeGroup_idx" ON "TrainingSession"("primaryAgeGroup");
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_athleteId_key" ON "AttendanceRecord"("sessionId", "athleteId");
CREATE INDEX "AttendanceRecord_athleteId_idx" ON "AttendanceRecord"("athleteId");
CREATE INDEX "AttendanceRecord_sessionId_idx" ON "AttendanceRecord"("sessionId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
