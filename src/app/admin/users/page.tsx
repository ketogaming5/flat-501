import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavBar } from "@/components/NavBar";
import { AdminUserManager } from "@/components/AdminUserManager";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard"); // server-side enforced, never trust client role

  const users = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="pb-24">
      <NavBar displayName={user.displayName} role={user.role} />
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">User Management</h1>
          <a href="/admin/adjustments" className="text-sm text-blue-600 font-medium">
            Adjustments →
          </a>
        </div>
        <AdminUserManager
          users={(users as any[]).map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            isActive: u.isActive,
          }))}
        />
      </main>
    </div>
  );
}
