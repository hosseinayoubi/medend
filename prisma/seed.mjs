import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const password = "Password123!";

  const passwordHash = await bcrypt.hash(password, 10);

  // ✅ idempotent: اگر وجود داشت update، اگر نبود create
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Demo User",
      // اگر نمی‌خوای هر بار پسورد ریست بشه، این خط رو کامنت کن:
      passwordHash,
    },
    create: {
      email,
      name: "Demo User",
      passwordHash,
    },
    select: { id: true, email: true },
  });

  // ✅ idempotent: journal هم حتماً وجود داشته باشه
  // اگر userId در Journal unique نیست و این upsert خطا داد، بهم بگو schema Journal چیه.
  await prisma.journal.upsert({
    where: { userId: user.id },
    update: {
      data: {
        version: 1,
        notes: ["Seeded"],
        updatedAt: new Date().toISOString(),
      },
    },
    create: {
      userId: user.id,
      data: {
        version: 1,
        notes: ["Seeded"],
        updatedAt: new Date().toISOString(),
      },
    },
  });

  console.log("Seeded user:", user.email);
  console.log("Seed password:", password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
