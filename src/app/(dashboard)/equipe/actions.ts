"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { createTeamMember, updateTeamMemberRole, removeTeamMember } from "@/services/team.service";

export async function addTeamMember(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const role = formData.get("role") as Role;

  if (!name || !email || !password || !role) return "Tous les champs sont requis.";
  if (password.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";

  try {
    await createTeamMember({ name, email, password, role }, session.user.role);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    if (err instanceof Error && err.message.includes("Unique constraint")) return "Cet email est déjà utilisé.";
    return "Erreur lors de la création.";
  }

  revalidatePath("/equipe");
}

export async function updateTeamMemberRoleAction(userId: string, role: Role) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  await updateTeamMemberRole(userId, role, session.user.role);
  revalidatePath("/equipe");
}

export async function removeTeamMemberAction(userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (session.user.id === userId) throw new Error("Impossible de se retirer soi-même.");
  await removeTeamMember(userId, session.user.role);
  revalidatePath("/equipe");
}
