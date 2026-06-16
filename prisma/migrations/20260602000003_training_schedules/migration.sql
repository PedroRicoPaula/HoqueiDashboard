-- CreateTable TrainingSchedule
CREATE TABLE "TrainingSchedule" (
    "id"          TEXT NOT NULL,
    "season"      TEXT NOT NULL,
    "seasonStart" TIMESTAMP(3),
    "ageGroup"    "AgeGroup" NOT NULL,
    "dayOfWeek"   INTEGER NOT NULL,
    "startTime"   TEXT NOT NULL,
    "endTime"     TEXT,
    "location"    TEXT,
    "sessionType" "SessionType" NOT NULL DEFAULT 'GENERAL',
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSchedule_pkey" PRIMARY KEY ("id")
);

-- AlterTable TrainingSession: add cancelled + scheduleId
ALTER TABLE "TrainingSession"
  ADD COLUMN IF NOT EXISTS "cancelled"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduleId"         TEXT;

-- CreateIndex
CREATE INDEX "TrainingSchedule_season_idx" ON "TrainingSchedule"("season");
CREATE INDEX "TrainingSchedule_ageGroup_idx" ON "TrainingSchedule"("ageGroup");
CREATE INDEX "TrainingSession_scheduleId_idx" ON "TrainingSession"("scheduleId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "TrainingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed 2025/26 schedules (Sub11, Sub13, Sub17)
INSERT INTO "TrainingSchedule" ("id", "season", "ageGroup", "dayOfWeek", "startTime", "endTime", "active", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), '2025/26', 'SUB11', 2, '19:00', '20:30', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB11', 5, '18:00', '19:00', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB13', 1, '19:00', '20:00', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB13', 3, '18:30', '19:30', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB13', 5, '19:00', '20:30', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB17', 1, '20:00', '21:30', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB17', 3, '19:30', '21:00', true, NOW(), NOW()),
  (gen_random_uuid(), '2025/26', 'SUB17', 5, '20:30', '22:00', true, NOW(), NOW());
