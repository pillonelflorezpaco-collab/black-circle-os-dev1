"use server";

import { revalidatePath } from "next/cache";
import type { VideoStage } from "@prisma/client";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { createVideo, updateVideoDetails, deleteVideoEntry, type VideoDetailsInput } from "@/services/video.service";

function readInput(formData: FormData): VideoDetailsInput {
  return {
    title: String(formData.get("title") || "").trim(),
    clientId: String(formData.get("clientId") || ""),
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
  if (!input.title || !input.clientId) return "Le titre et le client sont requis.";

  try {
    await createVideo(input, session.user.role, session.user.id);
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
  if (!videoId || !input.title || !input.clientId) return "Le titre et le client sont requis.";

  try {
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
  await deleteVideoEntry(videoId, session.user.role);
  revalidatePath("/pipeline");
}
