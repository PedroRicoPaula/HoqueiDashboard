-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "feeExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "editFees" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewFees" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AthletePayment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "amount" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "AthletePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthletePayment_athleteId_year_idx" ON "AthletePayment"("athleteId", "year");

-- CreateIndex
CREATE INDEX "AthletePayment_year_month_idx" ON "AthletePayment"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AthletePayment_athleteId_month_year_key" ON "AthletePayment"("athleteId", "month", "year");

-- AddForeignKey
ALTER TABLE "AthletePayment" ADD CONSTRAINT "AthletePayment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
