import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllBalances } from "@/lib/ledger";
import { NavBar } from "@/components/NavBar";
import { Card } from "@/components/ui";

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/my-expenses");

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.month ?? String(now.getMonth() + 1), 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [expenses, balances] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      include: { paidBy: { select: { displayName: true } } },
    }),
    getAllBalances(),
  ]);

  const totalSpending = expenses.reduce((acc: any, e: any) => acc.plus(new Decimal(e.amount.toString())), new Decimal(0));
  const perUser = new Map<string, Decimal>();
  for (const e of expenses) {
    const prev = perUser.get(e.paidBy.displayName) ?? new Decimal(0);
    perUser.set(e.paidBy.displayName, prev.plus(new Decimal(e.amount.toString())));
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <h1 className="text-lg font-bold text-slate-900">{monthLabel} Summary</h1>
        <Card>
          <p className="text-xs text-slate-500">Total Spending</p>
          <p className="text-2xl font-bold text-slate-900">₹{totalSpending.toFixed(2)}</p>
        </Card>
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Spending Per Person</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {Array.from(perUser.entries()).map(([name, total]: [string, any]) => (
              <div key={name} className="p-3 flex items-center justify-between">
                <span className="text-sm text-slate-900">{name}</span>
                <span className="text-sm font-bold">₹{total.toFixed(2)}</span>
              </div>
            ))}
            {perUser.size === 0 && <p className="p-4 text-sm text-slate-400">No expenses this month.</p>}
          </Card>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Outstanding Balances</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {(balances as any[]).map((b: any) => (
              <div key={b.userId} className="p-3 flex items-center justify-between">
                <span className="text-sm text-slate-900">{b.displayName}</span>
                <span className={`text-sm font-bold ${b.balance.greaterThanOrEqualTo(0) ? "text-green-600" : "text-red-600"}`}>
                  ₹{b.balance.toFixed(2)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </main>
    </div>
  );
}
