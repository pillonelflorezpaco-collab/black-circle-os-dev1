import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { verifyModelSession } from "@/lib/modelSession";

const { auth } = NextAuth(authConfig);

const PORTAL_COOKIE = "bc_portal_session";

async function handlePortalRoute(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginRoute = pathname === "/portail/login";
  if (isLoginRoute) return NextResponse.next();

  const modelId = await verifyModelSession(req.cookies.get(PORTAL_COOKIE)?.value);
  if (!modelId) {
    return NextResponse.redirect(new URL("/portail/login", req.nextUrl.origin));
  }
  return NextResponse.next();
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthApi = pathname.startsWith("/api/auth");
  const isWebhook = pathname.startsWith("/api/webhooks");
  // Engine-to-engine contract (future Agents layer, other Engines) — auth is
  // a Bearer EngineApiKey checked inside each route (src/lib/engineAuth.ts),
  // not a browser session, same pattern as the webhooks bypass above.
  const isEngineApi = pathname.startsWith("/api/engine");

  if (isAuthApi || isWebhook || isEngineApi) return NextResponse.next();

  if (pathname.startsWith("/portail")) {
    return handlePortalRoute(req);
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (pathname.startsWith("/agencies") && req.auth?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
