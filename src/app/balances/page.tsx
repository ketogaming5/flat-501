import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAllBalances, getPairwiseBalances } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { Card, Badge } from "@/components/ui";

export default async function BalancesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/my-expenses");

  const [balances, pairwise, users] = await Promise.all([
    getAllBalances(),
    getPairwiseBalances(),
    prisma.user.findMany({ where: { isActive: true } }),
  ]);
  const nameOf = (id: string) => (users as any[]).find((u: any) => u.id === id)?.displayName ?? id;

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Net Balances</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {(balances as any[]).map((b: any) => (
              <div key={b.userId} className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">{b.displayName}</span>
                <Badge tone={b.balance.greaterThanOrEqualTo(0) ? "positive" : "negative"}>
                  {b.balance.greaterThanOrEqualTo(0) ? "is owed " : "owes "}₹{b.balance.abs().toFixed(2)}
                </Badge>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Who Owes Whom</h2>
          <Card className="divide-y divide-slate-100 !p-0">
            {pairwise.length === 0 && <p className="p-4 text-sm text-slate-400">Everyone is settled up.</p>}
            {(pairwise as any[]).map((p: any, i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <span className="text-sm text-slate-900">
                  {nameOf(p.fromUserId)} owes {nameOf(p.toUserId)}
                </span>
                <span className="text-sm font-bold text-red-600">₹{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </Card>
        </section>
      </main>
    </div>
  );
}
