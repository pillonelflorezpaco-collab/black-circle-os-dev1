"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ForbiddenError, assertSameAgency } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import {
  updateModelNotes,
  assignModelUser,
  unassignModelUser,
  addSocialAccountAccess,
  removeSocialAccountAccess,
  revealSocialAccountPassword,
} from "@/services/model.service";
import { modelRepository } from "@/repositories/model.repository";
import type { Platform } from "@prisma/client";

export async function updateModelNotesAction(modelId: string, notes: string): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  try {
    const existing = await modelRepository.findById(modelId);
    assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
    await updateModelNotes(modelId, notes, session.user.role);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de la mise à jour des notes.";
  }

  revalidatePath(`/models/${modelId}`);
}

export async function assignModelUserAction(modelId: string, userId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");

  const existing = await modelRepository.findById(modelId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
  await assignModelUser(modelId, userId, session.user.role);
  revalidatePath(`/models/${modelId}`);
}

export async function unassignModelUserAction(assignmentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");

  const existing = await modelRepository.findAssignmentById(assignmentId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.model.agencyId);
  await unassignModelUser(assignmentId, session.user.role);
  if (existing) revalidatePath(`/models/${existing.modelId}`);
}

export async function addSocialAccountAccessAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const modelId = String(formData.get("modelId") || "");
  const platform = String(formData.get("platform") || "") as Platform;
  const displayName = String(formData.get("displayName") || "").trim() || null;
  const isMotherAccount = formData.get("isMotherAccount") === "on";
  const loginIdentifier = String(formData.get("loginIdentifier") || "").trim() || null;
  const loginPassword = String(formData.get("loginPassword") || "").trim() || null;
  if (!modelId || !platform) return "La plateforme est requise.";

  try {
    const existing = await modelRepository.findById(modelId);
    assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
    await addSocialAccountAccess(modelId, { platform, displayName, isMotherAccount, loginIdentifier, loginPassword }, session.user.role);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de l'ajout du compte.";
  }

  revalidatePath(`/models/${modelId}`);
}

export async function removeSocialAccountAccessAction(accountId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");

  const existing = await modelRepository.findSocialAccountById(accountId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.model.agencyId);
  await removeSocialAccountAccess(accountId, session.user.role);
  if (existing) revalidatePath(`/models/${existing.modelId}`);
}

/** The only path in the app that returns a decrypted account password — agency-checked, then permission-checked inside the service, and only ever called on explicit user action (never during page render). */
export async function revealSocialAccountPasswordAction(accountId: string): Promise<string | null> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");

  const existing = await modelRepository.findSocialAccountById(accountId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.model.agencyId);
  return revealSocialAccountPassword(accountId, session.user.role);
}
