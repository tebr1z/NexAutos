import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
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

  await prisma.setting.upsert({
    where: { key: "trackingPrefix" },
    update: {},
    create: { key: "trackingPrefix", value: "ANX" },
  });

  console.log(`Admin ready: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
