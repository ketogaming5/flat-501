"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, Select } from "@/components/ui";

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
}

export function AdminUserManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user.");
        return;
      }
      setUsername("");
      setPassword("");
      setDisplayName("");
      setRole("USER");
      setShowCreate(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: UserRow) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    router.refresh();
  }

  async function resetPassword(user: UserRow) {
    const newPassword = prompt(`New password for ${user.displayName} (min 6 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    router.refresh();
  }

  async function changeRole(user: UserRow, newRole: "ADMIN" | "USER") {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowCreate((v) => !v)} variant="secondary">
        {showCreate ? "Cancel" : "+ Create New User"}
      </Button>

      {showCreate && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="divide-y divide-slate-100 !p-0">
        {users.map((u: any) => (
          <div key={u.id} className="p-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {u.displayName} <span className="text-slate-400">@{u.username}</span>
              </p>
              <p className="text-xs text-slate-500">
                {u.role} · {u.isActive ? "Active" : "Disabled"}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => changeRole(u, u.role === "ADMIN" ? "USER" : "ADMIN")}
                className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-600"
              >
                Make {u.role === "ADMIN" ? "User" : "Admin"}
              </button>
              <button
                onClick={() => resetPassword(u)}
                className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-600"
              >
                Reset Pw
              </button>
              <button
                onClick={() => toggleActive(u)}
                className={`text-xs px-2 py-1 rounded-md border ${
                  u.isActive ? "border-red-300 text-red-600" : "border-green-300 text-green-600"
                }`}
              >
                {u.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
