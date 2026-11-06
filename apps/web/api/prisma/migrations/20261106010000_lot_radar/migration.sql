CREATE TABLE "LotWatch" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "filters" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false, "initializedAt" TIMESTAMP(3), "checkedAt" TIMESTAMP(3),
  "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "LotWatchLot" (
  "id" TEXT PRIMARY KEY, "watchId" TEXT NOT NULL, "lotKey" TEXT NOT NULL, "data" JSONB NOT NULL,
  "isAlert" BOOLEAN NOT NULL DEFAULT false, "readAt" TIMESTAMP(3), "emailSentAt" TIMESTAMP(3), "whatsappSentAt" TIMESTAMP(3),
  "emailError" TEXT, "whatsappError" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "deliveryLeaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LotWatchLot_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "LotWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LotWatch_enabled_nextCheckAt_idx" ON "LotWatch"("enabled", "nextCheckAt");
CREATE INDEX "LotWatch_userId_createdAt_idx" ON "LotWatch"("userId", "createdAt");
CREATE UNIQUE INDEX "LotWatchLot_watchId_lotKey_key" ON "LotWatchLot"("watchId", "lotKey");
CREATE INDEX "LotWatchLot_watchId_isAlert_createdAt_idx" ON "LotWatchLot"("watchId", "isAlert", "createdAt");
