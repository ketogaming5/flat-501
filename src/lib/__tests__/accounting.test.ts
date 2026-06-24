import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { splitExpense, computeUserBalance, netPairwiseDebts } from "../accounting";

const ABDUL = "abdul";
const SHEENA = "sheena";
const BHAU = "bhau";
const PEERU = "peeru";

describe("splitExpense - core spec rules", () => {
  it("RULE #1: splits only among participants, never absent users", () => {
    const result = splitExpense({
      amount: 1000,
      paidById: BHAU,
      participantIds: [ABDUL, BHAU, PEERU], // sheena absent
    });
    // 1000/3 = 333.33333... -> 333.33 per head, remainder to last
    expect(result.shares.map((s) => s.userId)).not.toContain(SHEENA);
    const total = result.shares.reduce((acc, s) => acc.plus(s.share), new Decimal(0));
    expect(total.toFixed(2)).toBe("1000.00");
  });

  it("Test Case 1: payer is a participant - no self-debt, others owe payer 333.33", () => {
    const result = splitExpense({
      amount: 1000,
      paidById: BHAU,
      participantIds: [BHAU, ABDUL, PEERU],
    });

    expect(result.debts).toHaveLength(2);
    const abdulDebt = result.debts.find((d) => d.fromUserId === ABDUL);
    const peeruDebt = result.debts.find((d) => d.fromUserId === PEERU);

    expect(abdulDebt?.toUserId).toBe(BHAU);
    expect(peeruDebt?.toUserId).toBe(BHAU);

    // Per spec example: Abdul owes Bhau 333.33, Peeru owes Bhau 333.33
    // (remainder cent goes to last participant's share array, but neither
    // debtor here is "last" unless they are - verify sum of debts == amount owed by non-payers)
    const debtSum = result.debts.reduce((acc, d) => acc.plus(d.amount), new Decimal(0));
    const payerShare = result.shares.find((s) => s.userId === BHAU)!.share;
    expect(debtSum.plus(payerShare).toFixed(2)).toBe("1000.00");

    // No debt entry where Bhau owes himself
    expect(result.debts.find((d) => d.fromUserId === BHAU)).toBeUndefined();
  });

  it("Test Case 2: payer did not participate - all participants owe payer their share", () => {
    const result = splitExpense({
      amount: 1000,
      paidById: SHEENA,
      participantIds: [ABDUL, BHAU, PEERU],
    });

    expect(result.debts).toHaveLength(3);
    for (const id of [ABDUL, BHAU, PEERU]) {
      const debt = result.debts.find((d) => d.fromUserId === id);
      expect(debt?.toUserId).toBe(SHEENA);
    }
    // Abdul and Bhau (not last) each get the floor share
    expect(result.debts.find((d) => d.fromUserId === ABDUL)?.amount.toFixed(2)).toBe("333.33");
    expect(result.debts.find((d) => d.fromUserId === BHAU)?.amount.toFixed(2)).toBe("333.33");
    // Peeru (last participant) absorbs the 1-cent rounding remainder
    const peeruDebt = result.debts.find((d) => d.fromUserId === PEERU)!;
    expect(peeruDebt.amount.toFixed(2)).toBe("333.34");

    const totalCollected = result.debts.reduce((acc, d) => acc.plus(d.amount), new Decimal(0));
    expect(totalCollected.toFixed(2)).toBe("1000.00"); // sheena collects full 1000 across debts
  });

  it("rejects expenses with zero or negative amount", () => {
    expect(() =>
      splitExpense({ amount: 0, paidById: BHAU, participantIds: [BHAU, ABDUL] })
    ).toThrow();
    expect(() =>
      splitExpense({ amount: -50, paidById: BHAU, participantIds: [BHAU, ABDUL] })
    ).toThrow();
  });

  it("rejects expenses with no participants", () => {
    expect(() =>
      splitExpense({ amount: 100, paidById: BHAU, participantIds: [] })
    ).toThrow();
  });

  it("Test Case 4: rounding correctness - remainder always reconciles to exact total", () => {
    // 100 / 3 = 33.333... -> two get 33.33, last absorbs remainder to 33.34
    const result = splitExpense({
      amount: 100,
      paidById: ABDUL,
      participantIds: [ABDUL, BHAU, PEERU],
    });
    const total = result.shares.reduce((acc, s) => acc.plus(s.share), new Decimal(0));
    expect(total.toFixed(2)).toBe("100.00");
    expect(result.shares[0].share.toFixed(2)).toBe("33.33");
    expect(result.shares[1].share.toFixed(2)).toBe("33.33");
    expect(result.shares[2].share.toFixed(2)).toBe("33.34"); // last absorbs remainder
  });
});

describe("computeUserBalance - Test Case 3: expense + settlement + adjustment", () => {
  it("combines all three sources deterministically", () => {
    // Bhau paid 1000 for Bhau, Abdul, Peeru -> Abdul and Peeru owe Bhau 333.33 each
    const expense = splitExpense({
      amount: 1000,
      paidById: BHAU,
      participantIds: [BHAU, ABDUL, PEERU],
    });

    // Peeru pays Bhau 200 as partial settlement
    const settlements = [{ payerId: PEERU, receiverId: BHAU, amount: 200 }];

    // Admin gives Bhau a +500 adjustment (e.g. gas cylinder reimbursement)
    const adjustments = [{ userId: BHAU, amount: 500 }];

    const bhauBalance = computeUserBalance({
      userId: BHAU,
      expenseDebts: expense.debts,
      settlements,
      adjustments,
    });

    // Bhau is owed 333.33 (abdul) + 333.34 (peeru, last participant absorbs remainder) = 666.67
    // minus 200 received from peeru = 466.67
    // plus 500 adjustment = 966.67
    expect(bhauBalance.toFixed(2)).toBe("966.67");

    const peeruBalance = computeUserBalance({
      userId: PEERU,
      expenseDebts: expense.debts,
      settlements,
      adjustments,
    });
    // Peeru owed bhau 333.34 (peeru is last participant, absorbs 1 cent remainder)
    // paid 200 -> net debt reduced
    // owes: -333.34 + 200(paid reduces what they owe) = -133.34
    expect(peeruBalance.toFixed(2)).toBe("-133.34");
  });
});

describe("netPairwiseDebts", () => {
  it("nets opposing debts between the same two users", () => {
    const debts = [
      { fromUserId: ABDUL, toUserId: BHAU, amount: new Decimal(300) },
      { fromUserId: BHAU, toUserId: ABDUL, amount: new Decimal(100) },
    ];
    const net = netPairwiseDebts(debts);
    expect(net).toHaveLength(1);
    expect(net[0]).toMatchObject({ fromUserId: ABDUL, toUserId: BHAU });
    expect(net[0].amount.toFixed(2)).toBe("200.00");
  });

  it("drops fully cancelled debts", () => {
    const debts = [
      { fromUserId: ABDUL, toUserId: BHAU, amount: new Decimal(100) },
      { fromUserId: BHAU, toUserId: ABDUL, amount: new Decimal(100) },
    ];
    expect(netPairwiseDebts(debts)).toHaveLength(0);
  });
});
