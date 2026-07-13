"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";

const CLIENT_COOKIE = "bc_client_id";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function setSelectedClient(clientId: string | null) {
  const store = await cookies();
  if (clientId) {
    store.set(CLIENT_COOKIE, clientId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete(CLIENT_COOKIE);
  }
  revalidatePath("/", "layout");
}

export async function getSelectedClientId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CLIENT_COOKIE)?.value ?? null;
}
