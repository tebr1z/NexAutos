-- Additive workflow update: existing stages and tracking records stay unchanged.
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'AUCTION_RELEASED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'EXPORT_READY';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'TO_ORIGIN_PORT';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CONTAINER_LOADING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'VESSEL_WAITING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'VESSEL_LOADED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'ISTANBUL_TO_POTI';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'DESTINATION_APPROACHING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CONTAINER_DISCHARGED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CONTAINER_OPENING_PENDING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CONTAINER_OPENED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'TIR_LOADING_PENDING';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CUSTOMS_DOCUMENTS';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CUSTOMS_DOCUMENTS_READY';

ALTER TABLE "Order"
  ADD COLUMN "originCountry" TEXT,
  ADD COLUMN "freightPaymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "documentMethod" TEXT NOT NULL DEFAULT 'UNSET',
  ADD COLUMN "documentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "purchasePaymentPercent" INTEGER,
  ADD COLUMN "commissionUsd" DECIMAL(12,2),
  ADD COLUMN "containerOpeningDate" VARCHAR(10),
  ADD COLUMN "reviewToken" TEXT,
  ADD CONSTRAINT "Order_originCountry_check" CHECK ("originCountry" IS NULL OR "originCountry" IN ('USA', 'KOREA', 'CHINA', 'OTHER')),
  ADD CONSTRAINT "Order_freightPaymentStatus_check" CHECK ("freightPaymentStatus" IN ('UNPAID', 'PARTIAL', 'PAID')),
  ADD CONSTRAINT "Order_documentMethod_check" CHECK ("documentMethod" IN ('UNSET', 'POWER_OF_ATTORNEY', 'SIGNIFY')),
  ADD CONSTRAINT "Order_documentStatus_check" CHECK ("documentStatus" IN ('PENDING', 'COMPLETED')),
  ADD CONSTRAINT "Order_purchasePaymentPercent_check" CHECK ("purchasePaymentPercent" IS NULL OR "purchasePaymentPercent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Order_commissionUsd_check" CHECK ("commissionUsd" IS NULL OR "commissionUsd" BETWEEN 0 AND 1000000),
  ADD CONSTRAINT "Order_containerOpeningDate_check" CHECK ("containerOpeningDate" IS NULL OR "containerOpeningDate" ~ '^\d{4}-\d{2}-\d{2}$');

CREATE UNIQUE INDEX "Order_reviewToken_key" ON "Order"("reviewToken");

CREATE TABLE "OrderReview" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "OrderReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderReview_orderId_key" ON "OrderReview"("orderId");
