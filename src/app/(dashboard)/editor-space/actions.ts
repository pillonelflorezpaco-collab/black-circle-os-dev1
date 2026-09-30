"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertSameAgency, can, ForbiddenError } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { prisma } from "@/lib/prisma";
import { moveBatchStatus, updateBatchNote, isValidBatchStatus } from "@/services/editorSpace.service";

async function loadOwnedBatch(batchId: string) {
  const session = await auth();
  if (!session?.user) throw new ForbiddenError("Non authentifié.");

  const batch = await prisma.editingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new ForbiddenError("Bloc introuvable.");
  assertSameAgency(await getEffectiveAgencyId(), batch.agencyId);

  const isManager = can(session.user.role, "gererEquipe");
  if (!isManager && batch.assignedEditorId !== session.user.id) {
    throw new ForbiddenError("Ce bloc n'est pas assigné à votre compte.");
  }
  return batch;
}

/** Moves a whole editing block to a new column (A_EDITER → EN_EDITION → PRET_POUR_REVIEW), dragged as one unit. */
export async function moveBatchStatusAction(batchId: string, newStatus: string): Promise<string | undefined> {
  if (!isValidBatchStatus(newStatus)) return "Statut invalide.";

  try {
    await loadOwnedBatch(batchId);
    await moveBatchStatus(batchId, newStatus);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors du déplacement du bloc.";
  }

  revalidatePath("/editor-space");
}

/** Trello-style note on a block ("il manque 2 vidéos", "qualité audio à revoir", …). */
export async function updateBatchNoteAction(batchId: string, note: string): Promise<string | undefined> {
  try {
    await loadOwnedBatch(batchId);
    await updateBatchNote(batchId, note);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de l'enregistrement de la note.";
  }

  revalidatePath("/editor-space");
}
