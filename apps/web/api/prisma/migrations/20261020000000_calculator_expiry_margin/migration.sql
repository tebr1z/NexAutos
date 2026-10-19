ALTER TABLE "CalculatorPlan"
  ADD COLUMN "accessUntil" VARCHAR(10),
  ADD COLUMN "profitMarginUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "surchargeAUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "surchargeBUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "surchargeCUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "CalculatorPlan" ALTER COLUMN "allowSelfPricing" SET DEFAULT true;
-- Enable self-service pricing for existing calculator accounts as requested.
-- Administrators can explicitly disable this again per account after deployment.
UPDATE "CalculatorPlan" SET "allowSelfPricing" = true;
