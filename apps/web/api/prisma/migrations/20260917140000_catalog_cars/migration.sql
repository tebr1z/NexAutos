CREATE TABLE IF NOT EXISTS "CatalogCar" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "year" INTEGER,
  "make" TEXT,
  "model" TEXT,
  "auction" TEXT,
  "color" TEXT,
  "priceUsd" INTEGER,
  "priceLabel" TEXT,
  "imageUrl" TEXT NOT NULL,
  "description" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CatalogCar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogCar_published_sortOrder_idx" ON "CatalogCar"("published", "sortOrder");
