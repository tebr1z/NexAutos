ALTER TABLE "LotWatch"
  ADD COLUMN "lastSource" TEXT,
  ADD COLUMN "browserAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "collectorUserId" TEXT;
