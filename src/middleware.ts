import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { verifyClientSession } from "@/lib/clientSession";

const { auth } = NextAuth(authConfig);

const PORTAL_COOKIE = "bc_portal_session";

async function handlePortalRoute(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginRoute = pathname === "/portail/login";
  if (isLoginRoute) return NextResponse.next();

  const clientId = await verifyClientSession(req.cookies.get(PORTAL_COOKIE)?.value);
  if (!clientId) {
    return NextResponse.redirect(new URL("/portail/login", req.nextUrl.origin));
  }
  return NextResponse.next();
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthApi = pathname.startsWith("/api/auth");
  const isWebhook = pathname.startsWith("/api/webhooks");

  if (isAuthApi || isWebhook) return NextResponse.next();

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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
