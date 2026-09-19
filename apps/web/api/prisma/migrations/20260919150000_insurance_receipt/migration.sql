ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "insuranceReceiptToken" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "insurancePaidOutAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Order_insuranceReceiptToken_key" ON "Order"("insuranceReceiptToken");
