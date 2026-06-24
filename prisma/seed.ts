import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { splitExpense } from "../src/lib/accounting";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding flat-101_Maani...");

  const h = (pw: string) => bcrypt.hash(pw, 12);

  const bhalu = await prisma.user.upsert({
    where: { username: "bhalu" },
    update: {},
    create: {
      username: "bhalu",
      passwordHash: await h("adminBhalu"),
      displayName: "Bhalu",
      role: "ADMIN",
    },
  });

  const [sheena, peeru, ajBhau] = await Promise.all([
    prisma.user.upsert({
      where: { username: "sheena" },
      update: {},
      create: {
        username: "sheena",
        passwordHash: await h("sheena123"),
        displayName: "Sheena",
        role: "USER",
      },
    }),
    prisma.user.upsert({
      where: { username: "peeru" },
      update: {},
      create: {
        username: "peeru",
        passwordHash: await h("peeru123"),
        displayName: "Peeru",
        role: "USER",
      },
    }),
    prisma.user.upsert({
      where: { username: "ajbhau" },
      update: {},
      create: {
        username: "ajbhau",
        passwordHash: await h("ajbhau123"),
        displayName: "Aj Bhau",
        role: "USER",
      },
    }),
  ]);

  const split1 = splitExpense({
    amount: 1200,
    paidById: bhalu.id,
    participantIds: [bhalu.id, sheena.id, peeru.id, ajBhau.id],
  });
  const exp1 = await prisma.expense.create({
    data: {
      title: "Groceries – D-Mart",
      amount: "1200.00",
      paidById: bhalu.id,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
      notes: "Monthly groceries run",
    },
  });
  await prisma.expenseParticipant.createMany({
    data: split1.shares.map((s) => ({
      expenseId: exp1.id,
      userId: s.userId,
      share: s.share.toFixed(2),
    })),
  });

  const split2 = splitExpense({
    amount: 900,
    paidById: bhalu.id,
    participantIds: [bhalu.id, peeru.id, ajBhau.id],
  });
  const exp2 = await prisma.expense.create({
    data: {
      title: "Dinner – Pizza Palace",
      amount: "900.00",
      paidById: bhalu.id,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      notes: "Sheena was out",
    },
  });
  await prisma.expenseParticipant.createMany({
    data: split2.shares.map((s) => ({
      expenseId: exp2.id,
      userId: s.userId,
      share: s.share.toFixed(2),
    })),
  });

  await prisma.settlement.create({
    data: {
      payerId: peeru.id,
      receiverId: bhalu.id,
      amount: "300.00",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      notes: "Partial payment",
    },
  });

  await prisma.adjustment.create({
    data: {
      userId: ajBhau.id,
      amount: "150.00",
      reason: "Gas Cylinder – share",
      createdById: bhalu.id,
    },
  });

  console.log("─────────────────────────────────────");
  console.log("bhalu   / adminBhalu  → ADMIN");
  console.log("sheena  / sheena123   → read-only");
  console.log("peeru   / peeru123    → read-only");
  console.log("ajbhau  / ajbhau123   → read-only");
  console.log("─────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());