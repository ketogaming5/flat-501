import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "flat101maani_session";

const PUBLIC_PATHS = ["/login", "/api/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic || pathname.startsWith("/_next") || pathname.startsWith("/manifest") || pathname === "/sw.js") {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: this only confirms a session cookie is present. The cookie's
  // validity (not expired, not revoked, user still active) and the
  // user's role are always re-checked server-side via requireUser()/
  // requireAdmin() in every route handler and server component — edge
  // middleware cannot safely query Postgres, so it is a coarse gate only,
  // never the actual authorization decision.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
};
