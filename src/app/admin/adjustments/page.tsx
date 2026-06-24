import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { AdjustmentForm } from "@/components/AdjustmentForm";
import { Card, Badge } from "@/components/ui";

export default async function AdminAdjustmentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [users, adjustments] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.adjustment.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { displayName: true } }, createdBy: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <h1 className="text-lg font-bold text-slate-900">Balance Adjustments</h1>
        <AdjustmentForm users={users.map((u: { id: string; displayName: string }) => ({ id: u.id, displayName: u.displayName }))} />

        <h2 className="text-lg font-bold text-slate-900 pt-2">Adjustment Ledger</h2>
        <Card className="divide-y divide-slate-100 !p-0">
          {adjustments.length === 0 && <p className="p-4 text-sm text-slate-400">No adjustments yet.</p>}
          {adjustments.map((a: { id: string; amount: { toString(): string }; reason: string; createdAt: Date; user: { displayName: string }; createdBy: { displayName: string } }) => {
            const amt = new Decimal(a.amount.toString());
            return (
              <div key={a.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.user.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {a.reason} · by {a.createdBy.displayName} · {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge tone={amt.greaterThanOrEqualTo(0) ? "positive" : "negative"}>
                  {amt.greaterThanOrEqualTo(0) ? "+" : ""}
                  {amt.toFixed(2)}
                </Badge>
              </div>
            );
          })}
        </Card>
      </main>
    </div>
  );
}
