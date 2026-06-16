-- User: add lastLoginAt
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- Quota: add notes
ALTER TABLE "Quota" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Travel: add new fields
ALTER TABLE "Travel" ADD COLUMN IF NOT EXISTS "convocados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Travel" ADD COLUMN IF NOT EXISTS "budgetTransport" DOUBLE PRECISION;
ALTER TABLE "Travel" ADD COLUMN IF NOT EXISTS "budgetMeal" DOUBLE PRECISION;
ALTER TABLE "Travel" ADD COLUMN IF NOT EXISTS "budgetAccommodation" DOUBLE PRECISION;
ALTER TABLE "Travel" ADD COLUMN IF NOT EXISTS "checklistItems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- DirectionSalaryPayment: new model
CREATE TABLE IF NOT EXISTS "DirectionSalaryPayment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "DirectionSalaryPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DirectionSalaryPayment" ADD CONSTRAINT "DirectionSalaryPayment_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "DirectionMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "DirectionSalaryPayment_memberId_month_year_key"
    ON "DirectionSalaryPayment"("memberId", "month", "year");

CREATE INDEX IF NOT EXISTS "DirectionSalaryPayment_memberId_year_idx"
    ON "DirectionSalaryPayment"("memberId", "year");
