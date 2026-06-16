-- Add amount column to Quota to store the value at time of payment
ALTER TABLE "Quota" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;
