export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-error";

const UpdateUserSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { displayName, role, isActive, newPassword } = parsed.data;
    const data: Record<string, unknown> = {};
    const auditDetails: string[] = [];

    if (displayName !== undefined) {
      data.displayName = displayName;
      auditDetails.push(`displayName -> ${displayName}`);
    }
    if (role !== undefined) {
      data.role = role;
      auditDetails.push(`role -> ${role}`);
    }
    if (isActive !== undefined) {
      data.isActive = isActive;
      auditDetails.push(isActive ? "enabled" : "disabled");
    }
    if (newPassword !== undefined) {
      data.passwordHash = await hashPassword(newPassword);
      auditDetails.push("password reset");
    }

    const updated = await prisma.user.update({ where: { id }, data });

    let action: "USER_UPDATED" | "USER_DISABLED" | "USER_ENABLED" | "PASSWORD_RESET" = "USER_UPDATED";
    if (isActive === false) action = "USER_DISABLED";
    else if (isActive === true) action = "USER_ENABLED";
    else if (newPassword !== undefined) action = "PASSWORD_RESET";

    await writeAuditLog({
      action,
      actorId: admin.id,
      targetId: updated.id,
      details: auditDetails.join(", "),
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        role: updated.role,
        isActive: updated.isActive,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
