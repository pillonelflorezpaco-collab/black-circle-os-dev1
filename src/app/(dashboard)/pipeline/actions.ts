"use server";

import { revalidatePath } from "next/cache";
import type { VideoStage } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ForbiddenError, assertSameAgency } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { createVideo, updateVideoDetails, deleteVideoEntry, type VideoDetailsInput } from "@/services/video.service";
import { videoRepository } from "@/repositories/video.repository";

function readInput(formData: FormData): VideoDetailsInput {
  return {
    title: String(formData.get("title") || "").trim(),
    modelId: String(formData.get("modelId") || ""),
    driveUrl: String(formData.get("driveUrl") || "").trim() || null,
    caption: String(formData.get("caption") || "").trim() || null,
    assignedEditorId: String(formData.get("assignedEditorId") || "") || null,
    stage: (String(formData.get("stage") || "RAW") as VideoStage) || undefined,
  };
}

export async function createVideoAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const input = readInput(formData);
  if (!input.title || !input.modelId) return "Le titre et le model sont requis.";

  const agencyId = await getEffectiveAgencyId();
  if (!agencyId) return "Sélectionne une agence avant de créer une vidéo.";

  try {
    await createVideo(input, session.user.role, agencyId, session.user.id);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de la création.";
  }

  revalidatePath("/pipeline");
}

export async function updateVideoAction(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user) return "Non authentifié.";

  const videoId = String(formData.get("videoId") || "");
  const input = readInput(formData);
  if (!videoId || !input.title || !input.modelId) return "Le titre et le model sont requis.";

  try {
    const existing = await videoRepository.findById(videoId);
    assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
    await updateVideoDetails(videoId, input, session.user.role, session.user.id);
  } catch (err) {
    if (err instanceof ForbiddenError) return err.message;
    return "Erreur lors de la mise à jour.";
  }

  revalidatePath("/pipeline");
}

export async function deleteVideoAction(videoId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  const existing = await videoRepository.findById(videoId);
  assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
  await deleteVideoEntry(videoId, session.user.role);
  revalidatePath("/pipeline");
}
