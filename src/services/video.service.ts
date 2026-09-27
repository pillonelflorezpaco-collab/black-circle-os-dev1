import type { Role, VideoStage } from "@prisma/client";
import { videoRepository } from "@/repositories/video.repository";
import { activityRepository } from "@/repositories/activity.repository";
import { integrationRepository } from "@/repositories/integration.repository";
import { sendTelegramMessage } from "@/lib/telegram";
import { createCalendarEvent } from "@/lib/googleCalendar";
import { assertCan } from "@/lib/permissions";

export const STAGE_LABELS: Record<VideoStage, string> = {
  RAW: "Raw",
  A_EDITER: "À éditer",
  EN_EDITION: "En édition",
  PRET_POUR_REVIEW: "Prêt pour review",
  VALIDE: "Validé",
  PROGRAMME: "Programmé",
  PUBLIE: "Publié",
};

export async function updateVideoStage(videoId: string, stage: VideoStage, actorId?: string) {
  const video = await videoRepository.update(videoId, {
    stage,
    stageUpdatedAt: new Date(),
    ...(actorId ? { lastEditedBy: { connect: { id: actorId } } } : {}),
  });
  const withModel = await videoRepository.findById(videoId);
  const modelName = withModel?.model?.name ?? "Model inconnu";
  const agencyId = video.agencyId;

  await activityRepository.log({
    eventType: "VIDEO_STAGE_CHANGED",
    message: `Vidéo déplacée vers ${STAGE_LABELS[stage]} — ${video.title} (${modelName})`,
    severity: "OK",
    modelId: withModel?.modelId,
    actorId,
    agencyId,
  });

  if (stage === "PRET_POUR_REVIEW") {
    await notifyReviewNeeded(video.id, video.title, modelName, agencyId);
  }

  return video;
}

/**
 * Best-effort notifications when a video needs review: a shared-calendar
 * event (due today, default reminders) + a Telegram message. Either channel
 * failing must not block the stage change itself — errors are logged to the
 * Integration row so the Automatisations page can surface them.
 */
async function notifyReviewNeeded(videoId: string, title: string, modelName: string, agencyId: string) {
  const message = `🎬 <b>À valider</b> — ${title} (${modelName})`;

  const results = await Promise.allSettled([
    createCalendarEvent({
      summary: `À valider : ${title} — ${modelName}`,
      description: `Vidéo prête pour review dans Black Circle OS.\nhttp://localhost:3000/pipeline`,
      startTime: new Date(),
      durationMinutes: 30,
    })
      .then(() => integrationRepository.updateStatus(agencyId, "GOOGLE_CALENDAR", "CONNECTED", { lastSyncAt: new Date() }))
      .catch((err) => {
        console.error("[notifyReviewNeeded] calendar failed:", err);
        return integrationRepository.updateStatus(agencyId, "GOOGLE_CALENDAR", "DISCONNECTED", { lastError: String(err?.message ?? err) });
      }),

    sendTelegramMessage(message)
      .then(() => integrationRepository.updateStatus(agencyId, "TELEGRAM", "CONNECTED", { lastSyncAt: new Date() }))
      .catch((err) => {
        console.error("[notifyReviewNeeded] telegram failed:", err);
        return integrationRepository.updateStatus(agencyId, "TELEGRAM", "DISCONNECTED", { lastError: String(err?.message ?? err) });
      }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[notifyReviewNeeded] notification channel update itself failed:", r.reason);
    }
  }
}

export async function listPipelineVideos(agencyId: string | null, modelId?: string | null) {
  return videoRepository.findAllGroupedByStage(agencyId, modelId);
}

export async function getModelStageCounts(modelId: string) {
  const grouped = await videoRepository.countByModelAndStage(modelId);
  const counts = Object.fromEntries(Object.keys(STAGE_LABELS).map((s) => [s, 0])) as Record<VideoStage, number>;
  for (const g of grouped) counts[g.stage] = g._count;
  return counts;
}

export type VideoDetailsInput = {
  title: string;
  modelId: string;
  driveUrl?: string | null;
  caption?: string | null;
  assignedEditorId?: string | null;
  stage?: VideoStage;
};

export async function createVideo(input: VideoDetailsInput, actorRole: Role, agencyId: string, actorId?: string) {
  assertCan(actorRole, "editerPipeline");
  return videoRepository.create({
    title: input.title,
    model: { connect: { id: input.modelId } },
    agency: { connect: { id: agencyId } },
    driveUrl: input.driveUrl || null,
    caption: input.caption || null,
    stage: input.stage ?? "RAW",
    ...(input.assignedEditorId ? { assignedEditor: { connect: { id: input.assignedEditorId } } } : {}),
    ...(actorId ? { lastEditedBy: { connect: { id: actorId } } } : {}),
  });
}

export async function updateVideoDetails(videoId: string, input: VideoDetailsInput, actorRole: Role, actorId?: string) {
  assertCan(actorRole, "editerPipeline");
  return videoRepository.update(videoId, {
    title: input.title,
    model: { connect: { id: input.modelId } },
    driveUrl: input.driveUrl || null,
    caption: input.caption || null,
    assignedEditor: input.assignedEditorId ? { connect: { id: input.assignedEditorId } } : { disconnect: true },
    ...(actorId ? { lastEditedBy: { connect: { id: actorId } } } : {}),
  });
}

export async function deleteVideoEntry(videoId: string, actorRole: Role) {
  assertCan(actorRole, "editerPipeline");
  return videoRepository.delete(videoId);
}
