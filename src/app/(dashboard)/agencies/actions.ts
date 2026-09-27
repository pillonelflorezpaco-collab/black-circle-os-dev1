"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { createAgency, updateAgencyStatus } from "@/services/agency.service";

export async function createAgencyAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const name = String(formData.get("name") || "").trim();
  if (!name) return "Le nom est requis.";

  try {
    await createAgency({ name }, session.user.role);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de la création.";
  }

  revalidatePath("/agencies");
}

export async function toggleAgencyStatusAction(id: string, status: "ACTIVE" | "SUSPENDED") {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  await updateAgencyStatus(id, status, session.user.role);
  revalidatePath("/agencies");
}
