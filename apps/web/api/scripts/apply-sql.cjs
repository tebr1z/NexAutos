"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "prisma", "migrations");

function statements(sql) {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureHistory(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function markApplied(prisma, name, sql) {
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","applied_steps_count")
     SELECT $1, $2, NOW(), $3, 1
     WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $3)`,
    id,
    checksum,
    name,
  );
}

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  if (!fs.existsSync(migrationsDir)) {
    console.error("prisma/migrations missing");
    process.exit(1);
  }
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
    .sort();

  await ensureHistory(prisma);

  for (const name of dirs) {
    const already = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "rolled_back_at" IS NULL LIMIT 1`,
      name,
    );
    if (Array.isArray(already) && already.length) {
      console.log(`Migration already applied: ${name}`);
      continue;
    }

    const file = path.join(migrationsDir, name, "migration.sql");
    const sql = fs.readFileSync(file, "utf8");
    for (const stmt of statements(sql)) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(message)) continue;
        throw err;
      }
    }
    try {
      await markApplied(prisma, name, sql);
    } catch (err) {
      console.warn("Could not record migration history:", err instanceof Error ? err.message : err);
    }
    console.log(`Applied SQL migration: ${name}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("apply-sql failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
