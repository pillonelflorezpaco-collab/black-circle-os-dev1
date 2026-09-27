"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";

const MODEL_COOKIE = "bc_model_id";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function setSelectedModel(modelId: string | null) {
  const store = await cookies();
  if (modelId) {
    store.set(MODEL_COOKIE, modelId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete(MODEL_COOKIE);
  }
  revalidatePath("/", "layout");
}

export async function getSelectedModelId(): Promise<string | null> {
  const store = await cookies();
  return store.get(MODEL_COOKIE)?.value ?? null;
}
