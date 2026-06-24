export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createSession,
  isRateLimited,
  recordFailedLogin,
  clearLoginAttempts,
} from "@/lib/auth";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }
  const { username, password } = parsed.data;

  if (isRateLimited(username)) {
    return NextResponse.json(
      { error: "Too many failed login attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Always run bcrypt.compare even on user-not-found to avoid leaking
  // user existence via response timing.
  const validPassword = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");

  if (!user || !user.isActive || !validPassword) {
    recordFailedLogin(username);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  clearLoginAttempts(username);
  await createSession(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
