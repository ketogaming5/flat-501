"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, Select } from "@/components/ui";

interface UserOption {
  id: string;
  displayName: string;
}

export function AdjustmentForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save adjustment.");
        return;
      }
      setAmount("");
      setReason("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>User</Label>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Amount (use negative for a deduction, e.g. -200)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="e.g. 500 or -200" />
        </div>
        <div>
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. Gas Cylinder" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Saving..." : "Save Adjustment"}
        </Button>
      </form>
    </Card>
  );
}
