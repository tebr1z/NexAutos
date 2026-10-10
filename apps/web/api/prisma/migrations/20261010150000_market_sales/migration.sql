CREATE TABLE "MarketSale" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lotNumber" TEXT,
    "vin" TEXT,
    "auction" TEXT,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "year" INTEGER,
    "engineCc" INTEGER,
    "engineLabel" TEXT,
    "fuel" TEXT,
    "color" TEXT,
    "location" TEXT,
    "state" TEXT,
    "mileageMi" INTEGER,
    "mileageKm" INTEGER,
    "finalBidUsd" INTEGER NOT NULL,
    "saleDate" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketSale_sourceKey_key" ON "MarketSale"("sourceKey");
CREATE INDEX "MarketSale_make_model_trim_idx" ON "MarketSale"("make", "model", "trim");
CREATE INDEX "MarketSale_year_engineCc_fuel_idx" ON "MarketSale"("year", "engineCc", "fuel");
CREATE INDEX "MarketSale_auction_saleDate_idx" ON "MarketSale"("auction", "saleDate");
CREATE INDEX "MarketSale_observedAt_idx" ON "MarketSale"("observedAt");
