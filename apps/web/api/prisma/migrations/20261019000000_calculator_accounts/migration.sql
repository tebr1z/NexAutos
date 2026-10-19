CREATE TABLE "CalculatorPlan" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "monthlyLimit" INTEGER CHECK ("monthlyLimit" >= 0),
 "allowSelfPricing" BOOLEAN NOT NULL DEFAULT false,
 "discountAUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "discountBUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "discountCUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "potiBakuUsd" DOUBLE PRECISION CHECK ("potiBakuUsd" >= 0),
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CalculatorUse" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "month" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CalculatorUse_userId_month_idx" ON "CalculatorUse"("userId", "month");
CREATE INDEX "CalculatorUse_userId_fingerprint_createdAt_idx" ON "CalculatorUse"("userId", "fingerprint", "createdAt");
CREATE TABLE "CalculatorBugReport" (
 "id" TEXT PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "message" TEXT NOT NULL,
 "pageUrl" TEXT,
 "version" TEXT,
 "status" TEXT NOT NULL DEFAULT 'OPEN',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CalculatorBugReport_status_createdAt_idx" ON "CalculatorBugReport"("status", "createdAt");
