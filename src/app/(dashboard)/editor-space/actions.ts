"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertCan, assertSameAgency, can, ForbiddenError } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { videoRepository } from "@/repositories/video.repository";
import { updateVideoStage } from "@/services/video.service";
import { nextEditorStage } from "@/services/editorSpace.service";

/** Advances a video to its next editing stage (A_EDITER → EN_EDITION → PRET_POUR_REVIEW). A VIDEO_EDITOR/EDITOR can only advance their own assigned videos; managers can advance any. */
export async function advanceEditorVideoStageAction(videoId: string): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  try {
    assertCan(session.user.role, "editerPipeline");
    const existing = await videoRepository.findById(videoId);
    if (!existing) return "Vidéo introuvable.";
    assertSameAgency(await getEffectiveAgencyId(), existing.agencyId);

    const isManager = can(session.user.role, "gererEquipe");
    if (!isManager && existing.assignedEditorId !== session.user.id) {
      return "Cette vidéo n'est pas assignée à votre compte.";
    }

    const next = nextEditorStage(existing.stage);
    if (!next) return "Cette vidéo est déjà au bout du pipeline d'édition.";

    await updateVideoStage(videoId, next, session.user.id);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors du changement de statut.";
  }

  revalidatePath("/editor-space");
}
