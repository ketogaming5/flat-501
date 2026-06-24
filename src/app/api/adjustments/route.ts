export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-error";

const CreateAdjustmentSchema = z.object({
  userId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).refine((v) => !new Decimal(v).isZero(), {
    message: "Amount cannot be zero.",
  }),
  reason: z.string().min(1).max(255),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = CreateAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const { userId, amount, reason } = parsed.data;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || !target.isActive) {
      return NextResponse.json({ error: "Target user is invalid or inactive." }, { status: 400 });
    }

    const adjustment = await prisma.adjustment.create({
      data: {
        userId,
        amount: new Decimal(amount).toFixed(2),
        reason,
        createdById: admin.id,
      },
    });

    await writeAuditLog({
      action: "ADJUSTMENT_CREATED",
      actorId: admin.id,
      targetId: userId,
      details: `${new Decimal(amount).toFixed(2)} - ${reason}`,
    });

    return NextResponse.json({ adjustment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    await requireUser();
    const adjustments = await prisma.adjustment.findMany({
      include: {
        user: { select: { id: true, displayName: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ adjustments });
  } catch (err) {
    return handleApiError(err);
  }
}
