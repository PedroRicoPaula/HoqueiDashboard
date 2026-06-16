-- CreateEnum
CREATE TYPE "TextileCategory" AS ENUM ('GAME', 'TRAINING', 'OTHER');
CREATE TYPE "TextileType" AS ENUM ('GAME_SHIRT', 'GAME_SHORTS', 'GAME_SOCKS', 'GK_SHIRT', 'TRAINING_TOP', 'TRAINING_PANTS', 'TRAINING_KIT', 'JACKET', 'TSHIRT', 'OTHER');
CREATE TYPE "TextileState" AS ENUM ('STOCK', 'ASSIGNED', 'DAMAGED', 'LOST');

-- CreateTable TextileItem
CREATE TABLE "TextileItem" (
    "id"                     TEXT NOT NULL,
    "category"               "TextileCategory" NOT NULL,
    "type"                   "TextileType" NOT NULL,
    "size"                   TEXT NOT NULL,
    "jerseyNumber"           INTEGER,
    "personalized"           BOOLEAN NOT NULL DEFAULT false,
    "personalizationDetails" TEXT,
    "season"                 TEXT NOT NULL,
    "state"                  "TextileState" NOT NULL DEFAULT 'STOCK',
    "athleteId"              TEXT,
    "isPartOfKit"            BOOLEAN NOT NULL DEFAULT false,
    "kitRef"                 TEXT,
    "paidByAthlete"          BOOLEAN NOT NULL DEFAULT false,
    "paidAmount"             DOUBLE PRECISION,
    "totalCost"              DOUBLE PRECISION,
    "notes"                  TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TextileItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextileItem_athleteId_idx" ON "TextileItem"("athleteId");
CREATE INDEX "TextileItem_state_idx" ON "TextileItem"("state");
CREATE INDEX "TextileItem_category_idx" ON "TextileItem"("category");
CREATE INDEX "TextileItem_season_idx" ON "TextileItem"("season");

-- AddForeignKey
ALTER TABLE "TextileItem" ADD CONSTRAINT "TextileItem_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
