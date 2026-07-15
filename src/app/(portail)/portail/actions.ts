"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutPortal() {
  const store = await cookies();
  store.delete("bc_portal_session");
  redirect("/portail/login");
}
