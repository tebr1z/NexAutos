try {
  require("dotenv").config();
} catch {
  /* Vexira/container already injects env */
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const shippingRates = require("./data/shipping-rates.json");

const prisma = new PrismaClient();

function yardSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedShippingRates() {
  const cells = {};
  const yards = {};
  for (const source of shippingRates.auctions || []) {
    const auction = String(source.code || "").toUpperCase();
    if (auction !== "COPART" && auction !== "IAAI") continue;
    for (const row of source.rates || []) {
      const [stateRaw, yardRaw, baseRaw] = row;
      const state = String(stateRaw || "").toUpperCase();
      const yard = String(yardRaw || "").trim();
      const slug = yardSlug(yard);
      const base = Math.round(Number(baseRaw));
      if (!/^[A-Z]{2}$/.test(state) || !slug || !Number.isFinite(base) || base <= 0) continue;
      const prefix = `${state}:${auction}:${slug}`;
      cells[`${prefix}:a`] = base;
      cells[`${prefix}:b`] = base + 50;
      cells[`${prefix}:c`] = base + 200;
      yards[prefix] = yard;
    }
  }

  const row = await prisma.setting.findUnique({ where: { key: "shipping_rates" } });
  const current = row?.value && typeof row.value === "object" ? row.value : {};
  const value = {
    tirUsd: Number(current.tirUsd) >= 0 ? Number(current.tirUsd) : Number(shippingRates.potiToBakuUsd) || 200,
    cells: { ...cells, ...(current.cells || {}) },
    yards: { ...yards, ...(current.yards || {}) },
    seedVersion: shippingRates.version,
  };
  await prisma.setting.upsert({
    where: { key: "shipping_rates" },
    update: { value },
    create: { key: "shipping_rates", value },
  });
  console.log(`Shipping rates ready: ${Object.keys(yards).length} yards / ${Object.keys(cells).length} cells`);
}

async function main() {
  await seedShippingRates();

  await prisma.setting.upsert({
    where: { key: "trackingPrefix" },
    update: {},
    create: { key: "trackingPrefix", value: "ANX" },
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Auto Nex";
  const phone = process.env.ADMIN_PHONE?.trim() || "994709668111";

  if (!email || !password || password.length < 10) {
    console.log("Admin seed skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars).");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, phone, passwordHash, role: "SUPER_ADMIN", isActive: true },
    create: {
      email,
      name,
      phone,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log(`Admin ready: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Admin seed failed:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(0);
  });
