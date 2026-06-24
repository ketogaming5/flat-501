import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Card } from "@/components/ui";

export default async function ExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/my-expenses");

  const [users, expenses] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } }),
    prisma.expense.findMany({
      orderBy: { date: "desc" },
      include: {
        paidBy: { select: { displayName: true } },
        participants: { include: { user: { select: { displayName: true } } } },
      },
    }),
  ]);

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <h1 className="text-lg font-bold text-slate-900">Add Expense</h1>
        <ExpenseForm users={(users as any[]).map((u: any) => ({ id: u.id, displayName: u.displayName }))} />

        <h2 className="text-lg font-bold text-slate-900 pt-2">Expense History</h2>
        <div className="space-y-3">
          {expenses.length === 0 && <p className="text-sm text-slate-400">No expenses recorded yet.</p>}
          {(expenses as any[]).map((e: any) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    Paid by {e.paidBy.displayName} · {new Date(e.date).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-bold text-slate-900">₹{new Decimal(e.amount.toString()).toFixed(2)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(e.participants as any[]).map((p: any) => (
                  <span key={p.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {p.user.displayName}: ₹{new Decimal(p.share.toString()).toFixed(2)}
                  </span>
                ))}
              </div>
              {e.notes && <p className="mt-2 text-xs text-slate-500">{e.notes}</p>}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
