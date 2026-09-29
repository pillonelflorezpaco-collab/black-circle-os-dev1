import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe subset of the NextAuth config — no Credentials provider here
 * (it pulls in bcryptjs + the Prisma pg adapter, both Node-only and unusable
 * in the Edge runtime that middleware.ts runs in). This config only decodes
 * the JWT to check "is there a session", which is edge-compatible.
 * The full config (lib/auth.ts) extends this with the actual provider for
 * everywhere else (Route Handlers, Server Components, Server Actions).
 */
export const authConfig = {
  // Required for self-hosted (non-Vercel) deployments: Auth.js v5 refuses to
  // trust the incoming request's Host header by default, and throws
  // UntrustedHost from inside the auth() call middleware.ts wraps — which,
  // uncaught, makes Next.js fail OPEN (serves the route, skips the
  // redirect-if-unauthenticated logic below) instead of blocking it. This
  // was the root cause of every dashboard route being reachable without a
  // session. Safe here because agency/role scoping never derives from the
  // Host header — only from the verified JWT — so trusting the host cannot
  // widen who a token authenticates as.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: Role }).role;
        token.agencyId = (user as { agencyId: string | null }).agencyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.role) session.user.role = token.role as Role;
      if (token.agencyId !== undefined) session.user.agencyId = token.agencyId as string | null;
      return session;
    },
  },
} satisfies NextAuthConfig;
