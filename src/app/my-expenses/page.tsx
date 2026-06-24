import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPairwiseBalances } from "@/lib/ledger";
import { Card } from "@/components/ui";
import { UserLogoutButton } from "@/components/UserLogoutButton";

export default async function MyExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/dashboard");

  const [pairwise, allUsers, participations] = await Promise.all([
    getPairwiseBalances(),
    prisma.user.findMany({ select: { id: true, displayName: true } }),
    prisma.expenseParticipant.findMany({
      where: { userId: user.id },
      include: {
        expense: {
          include: {
            paidBy: { select: { id: true, displayName: true } },
            participants: {
              include: { user: { select: { id: true, displayName: true } } },
            },
          },
        },
      },
      orderBy: { expense: { date: "desc" } },
    }),
  ]);

  const nameOf = (id: string) =>
    (allUsers as any[]).find((u: any) => u.id === id)?.displayName ?? id;

  const myBalances = (pairwise as any[]).filter(
    (p: any) => p.fromUserId === user.id || p.toUserId === user.id
  );

  const iOwe = myBalances.filter((p: any) => p.fromUserId === user.id);
  const owedToMe = myBalances.filter((p: any) => p.toUserId === user.id);
  const allSettled = myBalances.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-slate-900">flat-101_Maani</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user.displayName}</span>
            <UserLogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-10">

        {/* Balance Summary */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Your Balance Summary
          </h2>
          <Card className="!p-0 overflow-hidden">
            {allSettled ? (
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-green-600">
                  ✓ You're all settled up!
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">
                      Person
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">
                      Amount
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iOwe.map((p: any) => (
                    <tr key={p.fromUserId + p.toUserId} className="bg-red-50/40">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {nameOf(p.toUserId)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        ₹{new Decimal(p.amount.toString()).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-red-500 font-medium">
                        you owe
                      </td>
                    </tr>
                  ))}
                  {owedToMe.map((p: any) => (
                    <tr key={p.fromUserId + p.toUserId} className="bg-green-50/40">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {nameOf(p.fromUserId)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        ₹{new Decimal(p.amount.toString()).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-green-600 font-medium">
                        owes you
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </section>

        {/* Expense History */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Your Expenses
          </h2>

          {(participations as any[]).length === 0 && (
            <Card>
              <p className="text-sm text-slate-400 text-center py-4">
                No expenses recorded for you yet.
              </p>
            </Card>
          )}

          <div className="space-y-3">
            {(participations as any[]).map(({ expense, share }: any) => {
              const myShare = new Decimal(share.toString());
              const total = new Decimal(expense.amount.toString());
              const isPayer = expense.paidById === user.id;

              const otherParticipants = (expense.participants as any[]).filter(
                (p: any) => p.userId !== expense.paidById
              );

              return (
                <Card key={expense.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{expense.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(expense.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">Total bill</p>
                      <p className="font-bold text-slate-900">₹{total.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Paid by</span>
                    <span className="font-medium text-slate-900">
                      {isPayer ? "You" : expense.paidBy.displayName}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Who was present</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(expense.participants as any[]).map((p: any) => (
                        <span
                          key={p.id}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            p.userId === user.id
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.userId === user.id ? "You" : p.user.displayName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isPayer ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-500">Who owes you</p>
                      {otherParticipants.length === 0 ? (
                        <p className="text-xs text-slate-400">You paid for yourself only.</p>
                      ) : (
                        otherParticipants.map((p: any) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                          >
                            <span className="text-sm font-medium text-green-800">
                              {p.user.displayName} owes you
                            </span>
                            <span className="text-sm font-bold text-green-900">
                              ₹{new Decimal(p.share.toString()).toFixed(2)}
                            </span>
                          </div>
                        ))
                      )}
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-500">Your own share</span>
                        <span className="text-sm font-medium text-slate-700">
                          ₹{myShare.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-800">
                        You owe {expense.paidBy.displayName}
                      </span>
                      <span className="text-lg font-bold text-amber-900">
                        ₹{myShare.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {expense.notes && (
                    <p className="text-xs text-slate-400 italic">{expense.notes}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}