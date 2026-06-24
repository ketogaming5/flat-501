import Decimal from "decimal.js";

// Deterministic rounding for currency: round half up, 2 decimal places.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export interface DebtEntry {
  fromUserId: string; // owes money
  toUserId: string; // is owed money
  amount: Decimal;
}

export interface SplitInput {
  amount: Decimal | string | number;
  paidById: string;
  participantIds: string[];
}

export interface SplitResult {
  perHeadShare: Decimal;
  /** Per-participant share, where the last participant absorbs the rounding remainder
   *  so that the sum of shares always exactly equals the original amount. */
  shares: { userId: string; share: Decimal }[];
  debts: DebtEntry[];
}

/**
 * Splits an expense amount evenly among participants and produces
 * debt entries from every participant who is NOT the payer, to the payer.
 *
 * Rules enforced:
 * - Only participants are charged (never absent users).
 * - If payer is a participant, no self-debt entry is created for the payer.
 * - If payer is not a participant, every participant owes the payer their share.
 * - Money math is exact via Decimal.js; the last share absorbs any rounding
 *   remainder so total shares always sum to the original amount exactly.
 */
export function splitExpense(input: SplitInput): SplitResult {
  const amount = new Decimal(input.amount);

  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Expense amount must be greater than zero.");
  }
  if (!input.participantIds || input.participantIds.length === 0) {
    throw new Error("An expense must have at least one participant.");
  }

  const uniqueParticipants = Array.from(new Set(input.participantIds));
  const n = uniqueParticipants.length;

  const rawShare = amount.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const shares: { userId: string; share: Decimal }[] = uniqueParticipants.map(
    (userId) => ({ userId, share: rawShare })
  );

  // Reconcile rounding remainder onto the last participant so shares sum exactly.
  const allocated = rawShare.times(n);
  const remainder = amount.minus(allocated);
  if (!remainder.isZero()) {
    const last = shares[shares.length - 1];
    last.share = last.share.plus(remainder);
  }

  const debts: DebtEntry[] = shares
    .filter((s) => s.userId !== input.paidById)
    .map((s: any) => ({
      fromUserId: s.userId,
      toUserId: input.paidById,
      amount: s.share,
    }));

  return { perHeadShare: rawShare, shares, debts };
}

export interface LedgerInputs {
  userId: string;
  expenseDebts: DebtEntry[]; // all debts generated across all expenses
  settlements: { payerId: string; receiverId: string; amount: Decimal | string | number }[];
  adjustments: { userId: string; amount: Decimal | string | number }[];
}

/**
 * Computes the net balance for a single user from all sources:
 * expenses (as debts owed/owing), settlements, and admin adjustments.
 *
 * Positive result  => this user is net OWED money by the household.
 * Negative result  => this user net OWES money to the household.
 */
export function computeUserBalance(input: LedgerInputs): Decimal {
  let balance = new Decimal(0);

  for (const debt of input.expenseDebts) {
    if (debt.toUserId === input.userId) {
      balance = balance.plus(debt.amount); // others owe this user
    }
    if (debt.fromUserId === input.userId) {
      balance = balance.minus(debt.amount); // this user owes others
    }
  }

  for (const s of input.settlements) {
    const amt = new Decimal(s.amount);
    if (s.receiverId === input.userId) {
      // this user received payment -> reduces what they're owed
      balance = balance.minus(amt);
    }
    if (s.payerId === input.userId) {
      // this user paid down a debt -> reduces what they owe (increases balance)
      balance = balance.plus(amt);
    }
  }

  for (const a of input.adjustments) {
    if (a.userId === input.userId) {
      balance = balance.plus(new Decimal(a.amount));
    }
  }

  return balance.toDecimalPlaces(2);
}

/**
 * Reduces a list of pairwise debts into simplified net pairwise balances
 * (e.g. if A owes B 100 and B owes A 30 from different expenses, nets to
 * A owes B 70). Does not do multi-party debt simplification (graph
 * minimization) by design — every debt stays traceable to who owes whom.
 */
export function netPairwiseDebts(debts: DebtEntry[]): DebtEntry[] {
  const net = new Map<string, Decimal>(); // key: "fromId|toId" canonicalized

  for (const d of debts) {
    if (d.amount.isZero()) continue;
    const [a, b] = [d.fromUserId, d.toUserId].sort();
    const key = `${a}|${b}`;
    const sign = d.fromUserId === a ? new Decimal(1) : new Decimal(-1);
    const prev = net.get(key) ?? new Decimal(0);
    net.set(key, prev.plus(d.amount.times(sign)));
  }

  const result: DebtEntry[] = [];
  for (const [key, value] of net.entries()) {
    if (value.isZero()) continue;
    const [a, b] = key.split("|");
    if (value.greaterThan(0)) {
      result.push({ fromUserId: a, toUserId: b, amount: value });
    } else {
      result.push({ fromUserId: b, toUserId: a, amount: value.abs() });
    }
  }
  return result;
}
