import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { SettlementForm } from "@/components/SettlementForm";
import { Card } from "@/components/ui";

export default async function SettlementsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/my-expenses");

  const [users, settlements] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.settlement.findMany({
      orderBy: { date: "desc" },
      include: { payer: { select: { displayName: true } }, receiver: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <h1 className="text-lg font-bold text-slate-900">Record Settlement</h1>
        <SettlementForm users={users.map((u: any) => ({ id: u.id, displayName: u.displayName }))} />

        <h2 className="text-lg font-bold text-slate-900 pt-2">Settlement History</h2>
        <Card className="divide-y divide-slate-100 !p-0">
          {settlements.length === 0 && <p className="p-4 text-sm text-slate-400">No settlements yet.</p>}
          {(settlements as any[]).map((s: any) => (
            <div key={s.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900">
                  {s.payer.displayName} → {s.receiver.displayName}
                </p>
                <p className="text-xs text-slate-500">{new Date(s.date).toLocaleDateString()}{s.notes ? ` · ${s.notes}` : ""}</p>
              </div>
              <p className="text-sm font-bold text-green-600">₹{new Decimal(s.amount.toString()).toFixed(2)}</p>
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
