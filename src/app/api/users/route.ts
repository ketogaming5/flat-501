export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireUser();
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, displayName: true, role: true },
      orderBy: { displayName: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateUserSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore only"),
  password: z.string().min(6),
  displayName: z.string().min(1).max(64),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const { username, password, displayName, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash, displayName, role },
    });

    await writeAuditLog({
      action: "USER_CREATED",
      actorId: admin.id,
      targetId: user.id,
      details: `Created user ${username} (${role})`,
    });

    return NextResponse.json(
      { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
