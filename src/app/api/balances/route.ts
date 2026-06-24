export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAllBalances, getPairwiseBalances } from "@/lib/ledger";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireUser();
    const [balances, pairwise] = await Promise.all([getAllBalances(), getPairwiseBalances()]);

    const userMap = new Map(
      (await prisma.user.findMany({ where: { isActive: true } })).map((u: any) => [u.id, u.displayName])
    );

    return NextResponse.json({
      balances: balances.map((b: any) => ({
        userId: b.userId,
        displayName: b.displayName,
        balance: b.balance.toFixed(2),
      })),
      pairwise: pairwise.map((p: any) => ({
        fromUserId: p.fromUserId,
        fromDisplayName: userMap.get(p.fromUserId) ?? p.fromUserId,
        toUserId: p.toUserId,
        toDisplayName: userMap.get(p.toUserId) ?? p.toUserId,
        amount: p.amount.toFixed(2),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
