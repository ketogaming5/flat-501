import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

// Mirror of the Role enum from prisma/schema.prisma.
// Defined here so auth.ts compiles without a generated Prisma client.
export type Role = "ADMIN" | "USER";

const SESSION_COOKIE = "flat101maani_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

/**
 * Creates a new session row + httpOnly cookie for the given user.
 * The raw token is sent to the client; only its SHA-256 hash is stored,
 * so a leaked database never exposes usable session tokens.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // same-site default mitigates CSRF for cookie-based auth without a token dance
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Validates the session cookie server-side against the database.
 * Returns null if missing, expired, or the user has been disabled.
 * This is the ONLY source of truth for "who is logged in" — never
 * trust a client-supplied role or user id.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Not authenticated", 401);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Best-effort in-memory login rate limiter, keyed by username.
 * NOTE: this resets on cold start and is NOT shared across serverless
 * instances/regions on Vercel. For a 4-person household app this is an
 * acceptable deterrent against casual brute force; it is explicitly NOT
 * a substitute for a distributed limiter (e.g. Upstash Redis) if you ever
 * expose this beyond a trusted household.
 */
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function isRateLimited(username: string): boolean {
  const entry = loginAttempts.get(username);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(username);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(username: string): void {
  const entry = loginAttempts.get(username);
  if (!entry || Date.now() - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(username, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}
