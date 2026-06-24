import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllBalances } from "@/lib/ledger";
import { NavBar } from "@/components/NavBar";
import { Card, Badge } from "@/components/ui";
import Decimal from "decimal.js";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/my-expenses");

  const [balances, recentExpenses, recentSettlements, recentAdjustments] = await Promise.all([
    getAllBalances(),
    prisma.expense.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: { paidBy: { select: { displayName: true } } },
    }),
    prisma.settlement.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: { payer: { select: { displayName: true } }, receiver: { select: { displayName: true } } },
    }),
    prisma.adjustment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { displayName: true } } },
    }),
  ]);

  const myBalance = (balances as any[]).find((b: any) => b.userId === user.id)?.balance ?? new Decimal(0);
  const totalOutstanding = (balances as any[]).reduce(
    (acc: Decimal, b: any) => (b.balance.greaterThan(0) ? acc.plus(b.balance) : acc),
    new Decimal(0)
  );

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-slate-500 mb-1">Your Balance</p>
            <p className={`text-2xl font-bold ${myBalance.greaterThanOrEqualTo(0) ? "text-green-600" : "text-red-600"}`}>
              ₹{myBalance.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {myBalance.greaterThanOrEqualTo(0) ? "You are owed" : "You owe"}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-slate-900">₹{totalOutstanding.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">Across household</p>
          </Card>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent Expenses</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {recentExpenses.length === 0 && <p className="p-4 text-sm text-slate-400">No expenses yet.</p>}
            {(recentExpenses as any[]).map((e: any) => (
              <div key={e.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    Paid by {e.paidBy.displayName} · {new Date(e.date).toLocaleDateString()}
                  </p>
                </div>
                <Badge>₹{new Decimal(e.amount.toString()).toFixed(2)}</Badge>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent Settlements</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {recentSettlements.length === 0 && <p className="p-4 text-sm text-slate-400">No settlements yet.</p>}
            {(recentSettlements as any[]).map((s: any) => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <p className="text-sm text-slate-900">
                  {s.payer.displayName} → {s.receiver.displayName}
                </p>
                <Badge tone="positive">₹{new Decimal(s.amount.toString()).toFixed(2)}</Badge>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent Adjustments</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {recentAdjustments.length === 0 && <p className="p-4 text-sm text-slate-400">No adjustments yet.</p>}
            {(recentAdjustments as any[]).map((a: any) => {
              const amt = new Decimal(a.amount.toString());
              return (
                <div key={a.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-900">{a.user.displayName}</p>
                    <p className="text-xs text-slate-500">{a.reason}</p>
                  </div>
                  <Badge tone={amt.greaterThanOrEqualTo(0) ? "positive" : "negative"}>
                    {amt.greaterThanOrEqualTo(0) ? "+" : ""}
                    {amt.toFixed(2)}
                  </Badge>
                </div>
              );
            })}
          </Card>
        </section>
      </main>
    </div>
  );
}
