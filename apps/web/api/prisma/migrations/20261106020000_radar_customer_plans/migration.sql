CREATE TABLE "RadarPlan" (
 "userId" TEXT PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "watchLimit" INTEGER NOT NULL DEFAULT 3, "monthlyAlertLimit" INTEGER NOT NULL DEFAULT 100,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RadarPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "RadarPlan_limits_check" CHECK ("watchLimit" BETWEEN 0 AND 100 AND "monthlyAlertLimit" BETWEEN 0 AND 1000000)
);
CREATE TABLE "RadarUsage" (
 "userId" TEXT NOT NULL, "month" VARCHAR(7) NOT NULL, "used" INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY ("userId", "month"),
 CONSTRAINT "RadarUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "LotWatchLot" ADD COLUMN "quotaBlocked" BOOLEAN NOT NULL DEFAULT false;
INSERT INTO "RadarPlan" ("userId", "enabled") SELECT "id", "role" <> 'CUSTOMER' FROM "User" ON CONFLICT DO NOTHING;
WITH ranked AS (
 SELECT w."id", ROW_NUMBER() OVER (PARTITION BY w."userId" ORDER BY w."createdAt", w."id") AS rn,
 p."enabled" AS plan_enabled, p."watchLimit" AS watch_limit
 FROM "LotWatch" w JOIN "RadarPlan" p ON p."userId" = w."userId" WHERE w."enabled" = true
)
UPDATE "LotWatch" w SET "enabled" = false, "leaseUntil" = NULL
FROM ranked r WHERE w."id" = r."id" AND (NOT r.plan_enabled OR r.rn > r.watch_limit);
