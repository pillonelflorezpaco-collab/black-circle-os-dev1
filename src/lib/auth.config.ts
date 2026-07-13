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
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.role) session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
