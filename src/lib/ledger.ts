import Decimal from "decimal.js";
import { prisma } from "./db";
import { computeUserBalance, netPairwiseDebts, type DebtEntry } from "./accounting";

/**
 * Reconstructs every debt entry in the system from stored ExpenseParticipant
 * shares (which were computed once at expense-creation time and are immutable).
 * This guarantees historical expenses are never silently re-split if the
 * splitting algorithm changes later.
 */
export async function getAllExpenseDebts(): Promise<DebtEntry[]> {
  const expenses = await prisma.expense.findMany({
    include: { participants: true },
  });

  const debts: DebtEntry[] = [];
  for (const expense of expenses) {
    for (const p of expense.participants) {
      if (p.userId === expense.paidById) continue; // payer never owes themself
      debts.push({
        fromUserId: p.userId,
        toUserId: expense.paidById,
        amount: new Decimal(p.share.toString()),
      });
    }
  }
  return debts;
}

export interface UserBalanceRow {
  userId: string;
  username: string;
  displayName: string;
  balance: Decimal; // positive = owed money, negative = owes money
}

export async function getAllBalances(): Promise<UserBalanceRow[]> {
  const [users, debts, settlements, adjustments] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true } }),
    getAllExpenseDebts(),
    prisma.settlement.findMany(),
    prisma.adjustment.findMany(),
  ]);

  return users.map((u: any) => ({
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    balance: computeUserBalance({
      userId: u.id,
      expenseDebts: debts,
      settlements: settlements.map((s: any) => ({
        payerId: s.payerId,
        receiverId: s.receiverId,
        amount: s.amount.toString(),
      })),
      adjustments: adjustments.map((a: any) => ({
        userId: a.userId,
        amount: a.amount.toString(),
      })),
    }),
  }));
}

/** Who-owes-whom pairwise breakdown, netted per pair (for the Balances screen). */
export async function getPairwiseBalances(): Promise<
  { fromUserId: string; toUserId: string; amount: Decimal }[]
> {
  const debts = await getAllExpenseDebts();
  const settlements = await prisma.settlement.findMany();

  // Settlements act as a reverse debt (payer -> receiver reduces payer's debt to receiver)
  const settlementDebts: DebtEntry[] = settlements.map((s: any) => ({
    fromUserId: s.receiverId,
    toUserId: s.payerId,
    amount: new Decimal(s.amount.toString()),
  }));

  return netPairwiseDebts([...debts, ...settlementDebts]);
}
