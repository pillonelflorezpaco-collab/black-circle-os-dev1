"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ForbiddenError, assertSameAgency } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import {
  updateModelNotes,
  addModelLink,
  removeModelLink,
  assignModelUser,
  unassignModelUser,
} from "@/services/model.service";
import { modelRepository } from "@/repositories/model.repository";

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

export async function addModelLinkAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const modelId = String(formData.get("modelId") || "");
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  if (!modelId || !label || !url) return "Le libellé et l'URL sont requis.";

  try {
    const existing = await modelRepository.findById(modelId);
    assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
    await addModelLink(modelId, label, url, session.user.role);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de l'ajout du lien.";
  }

  revalidatePath(`/models/${modelId}`);
}

export async function removeModelLinkAction(linkId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");

  const existing = await modelRepository.findLinkById(linkId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.model.agencyId);
  await removeModelLink(linkId, session.user.role);
  if (existing) revalidatePath(`/models/${existing.modelId}`);
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
