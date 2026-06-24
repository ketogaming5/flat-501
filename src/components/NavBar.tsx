"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavBarProps {
  displayName: string;
  role: "ADMIN" | "USER";
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/expenses", label: "Expenses", icon: "🧾" },
  { href: "/balances", label: "Balances", icon: "⚖️" },
  { href: "/settlements", label: "Settle", icon: "💸" },
];

export function NavBar({ displayName, role }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg text-slate-900">
            flat-101_Maani
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden sm:inline">{displayName}</span>
            {role === "ADMIN" && (
              <Link
                href="/admin/users"
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium"
              >
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {NAV_ITEMS.map((item: any) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 ${
                  active ? "text-blue-600 font-semibold" : "text-slate-500"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
