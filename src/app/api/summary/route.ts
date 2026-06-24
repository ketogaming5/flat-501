export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAllBalances } from "@/lib/ledger";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10); // 1-12

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const [rawExpenses, rawSettlements, rawAdjustments, balances] = await Promise.all([
      prisma.expense.findMany({
        where: { date: { gte: start, lt: end } },
        include: { paidBy: { select: { id: true, displayName: true } } },
      }),
      prisma.settlement.findMany({
        where: { date: { gte: start, lt: end } },
        include: {
          payer: { select: { id: true, displayName: true } },
          receiver: { select: { id: true, displayName: true } },
        },
      }),
      prisma.adjustment.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { user: { select: { id: true, displayName: true } } },
      }),
      getAllBalances(),
    ]);

    const expenses = rawExpenses as any[];
    const settlements = rawSettlements as any[];
    const adjustments = rawAdjustments as any[];
    const totalSpending = expenses.reduce((acc: any, e: any) => acc.plus(new Decimal(e.amount.toString())),
      new Decimal(0)
    );

    const perUserPaid = new Map<string, Decimal>();
    for (const e of expenses) {
      const prev = perUserPaid.get(e.paidById) ?? new Decimal(0);
      perUserPaid.set(e.paidById, prev.plus(new Decimal(e.amount.toString())));
    }

    return NextResponse.json({
      period: { year, month },
      totalSpending: totalSpending.toFixed(2),
      expensesPerUser: Array.from(perUserPaid.entries()).map(([userId, total]) => ({
        userId,
        displayName: expenses.find((e: any) => e.paidById === userId)?.paidBy.displayName ?? userId,
        totalPaid: total.toFixed(2),
      })),
      outstandingBalances: (balances as any[]).map((b: any) => ({
        userId: b.userId,
        displayName: b.displayName,
        balance: b.balance.toFixed(2),
      })),
      settlements: (settlements as any[]).map((s: any) => ({
        id: s.id,
        payer: s.payer.displayName,
        receiver: s.receiver.displayName,
        amount: s.amount.toString(),
        date: s.date,
      })),
      adjustments: adjustments.map((a: any) => ({
        id: a.id,
        user: a.user.displayName,
        amount: a.amount.toString(),
        reason: a.reason,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
