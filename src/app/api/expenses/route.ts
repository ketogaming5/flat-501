export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { splitExpense } from "@/lib/accounting";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-error";

const CreateExpenseSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.union([z.string(), z.number()]).refine((v) => new Decimal(v).greaterThan(0), {
    message: "Amount must be greater than zero.",
  }),
  paidById: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1, "Select at least one participant."),
  date: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const { title, amount, paidById, participantIds, date, notes } = parsed.data;

    // Validate payer + all participants are real, active users.
    const relevantIds = Array.from(new Set([paidById, ...participantIds]));
    const users = await prisma.user.findMany({ where: { id: { in: relevantIds }, isActive: true } });
    if (users.length !== relevantIds.length) {
      return NextResponse.json({ error: "One or more users are invalid or inactive." }, { status: 400 });
    }

    // Run through the verified accounting engine to compute exact shares.
    const split = splitExpense({ amount, paidById, participantIds });

    const expense = await prisma.$transaction(async (tx: any) => {
      const created = await tx.expense.create({
        data: {
          title,
          amount: new Decimal(amount).toFixed(2),
          paidById,
          date: new Date(date),
          notes,
        },
      });

      await tx.expenseParticipant.createMany({
        data: split.shares.map((s: any) => ({
          expenseId: created.id,
          userId: s.userId,
          share: s.share.toFixed(2),
        })),
      });

      return created;
    });

    await writeAuditLog({
      action: "EXPENSE_CREATED",
      actorId: user.id,
      details: `${title}: ${new Decimal(amount).toFixed(2)} paid by ${paidById}, split ${participantIds.length} ways`,
    });

    return NextResponse.json({ expense, shares: split.shares.map((s: any) => ({ userId: s.userId, share: s.share.toFixed(2) })) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    await requireUser();
    const expenses = await prisma.expense.findMany({
      include: {
        paidBy: { select: { id: true, displayName: true } },
        participants: { include: { user: { select: { id: true, displayName: true } } } },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ expenses });
  } catch (err) {
    return handleApiError(err);
  }
}
