CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key"       TEXT NOT NULL,
  "count"     INTEGER NOT NULL DEFAULT 1,
  "resetAt"   TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
