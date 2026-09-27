"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

const ACTING_AGENCY_COOKIE = "bc_acting_agency_id";

/**
 * Resolves the agencyId that should scope the current request's data access.
 *
 * - Non-Super-Admin sessions: always their own fixed session.user.agencyId —
 *   the cookie below is never consulted for them, so a non-Super-Admin can
 *   never widen their own scope by setting it.
 * - Super Admin sessions (session.user.agencyId === null): the agency they're
 *   currently "acting as" via the switcher, stored in a cookie (mirrors the
 *   existing bc_client_id / bc_model_id pattern) — or null if they haven't
 *   picked one yet, meaning "cross-agency / global" view.
 */
export async function getEffectiveAgencyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== "SUPER_ADMIN") return session.user.agencyId;

  const store = await cookies();
  return store.get(ACTING_AGENCY_COOKIE)?.value ?? null;
}

export async function setActingAgency(agencyId: string | null) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return; // no-op for non-Super-Admins

  const store = await cookies();
  if (agencyId) {
    store.set(ACTING_AGENCY_COOKIE, agencyId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete(ACTING_AGENCY_COOKIE);
  }
}

export async function getActingAgencyId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTING_AGENCY_COOKIE)?.value ?? null;
}
