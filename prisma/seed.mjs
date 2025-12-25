import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const password = "Password123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed user already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Demo User",
      passwordHash,
    },
  });

  await prisma.journal.create({
    data: {
      userId: user.id,
      data: { version: 1, notes: ["Seeded"], updatedAt: new Date().toISOString() },
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
