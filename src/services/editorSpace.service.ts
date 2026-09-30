import { prisma } from "@/lib/prisma";
import { activityRepository } from "@/repositories/activity.repository";
import { sendTelegramMessage } from "@/lib/telegram";
import { listDriveFolderChildren, getFileParents, moveDriveFile } from "@/lib/googleDrive";
import type { VideoStage } from "@prisma/client";

// The internal-mirror platform folders (e.g. "REELS") use this 3-step
// structure in Drive itself — matched by keyword since exact spelling drifts
// ("2 — LISTO PARA PUBLICAR" vs "2 — Listo para publicar"). Not every
// platform folder has it (e.g. some models' "ONLYFANS" mirror only has a
// flat "YA SUBIDO OF" folder) — when a stage subfolder isn't found, the file
// is just left where it is rather than treated as an error.
const STAGE_SUBFOLDER_KEYWORD: Partial<Record<VideoStage, string>> = {
  EN_EDITION: "EDICI", // matches "EN EDICIÓN"
  PRET_POUR_REVIEW: "LISTO", // matches "LISTO PARA PUBLICAR"
};

const COLUMN_STAGES: VideoStage[] = ["A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW"];

export interface EditingBatchView {
  id: string;
  modelId: string;
  modelName: string;
  weekLabel: string;
  status: VideoStage;
  note: string | null;
  editorId: string | null;
  editorName: string | null;
  videoCount: number;
}

/**
 * All active batches (one "block" per model/week/editor) for the kanban —
 * every editor's when onlyEditorId is omitted (the manager view), or just
 * one editor's own blocks otherwise.
 */
export async function getEditingBatches(agencyId: string | null, onlyEditorId?: string): Promise<EditingBatchView[]> {
  const batches = await prisma.editingBatch.findMany({
    where: {
      status: { in: COLUMN_STAGES },
      ...(agencyId ? { agencyId } : {}),
      ...(onlyEditorId ? { assignedEditorId: onlyEditorId } : {}),
    },
    include: {
      model: { select: { id: true, name: true } },
      assignedEditor: { select: { id: true, name: true } },
      _count: { select: { videos: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  return batches.map((b) => ({
    id: b.id,
    modelId: b.modelId,
    modelName: b.model.name,
    weekLabel: b.weekLabel,
    status: b.status,
    note: b.note,
    editorId: b.assignedEditorId,
    editorName: b.assignedEditor?.name ?? null,
    videoCount: b._count.videos,
  }));
}

/** "Combien de vidéos {éditrice} a-t-elle éditées" — grouped by week, for Jarvis and the tracking bar. */
export async function getEditedVideoCountByWeek(editorId: string, agencyId: string | null): Promise<{ weekLabel: string; count: number }[]> {
  const batches = await prisma.editingBatch.findMany({
    where: { assignedEditorId: editorId, status: "PRET_POUR_REVIEW", ...(agencyId ? { agencyId } : {}) },
    include: { _count: { select: { videos: true } } },
  });
  const byWeek = new Map<string, number>();
  for (const b of batches) byWeek.set(b.weekLabel, (byWeek.get(b.weekLabel) ?? 0) + b._count.videos);
  return Array.from(byWeek.entries()).map(([weekLabel, count]) => ({ weekLabel, count }));
}

const NEXT_STATUS: Partial<Record<VideoStage, VideoStage>> = {
  A_EDITER: "EN_EDITION",
  EN_EDITION: "PRET_POUR_REVIEW",
};

export function isValidBatchStatus(stage: string): stage is VideoStage {
  return (COLUMN_STAGES as string[]).includes(stage);
}

/**
 * Best-effort: relocates every video in a batch into the Drive stage
 * subfolder matching `newStatus` (see STAGE_SUBFOLDER_KEYWORD), inside
 * whichever internal platform folder each video was originally synced into.
 * A video missing that info (synced before this feature existed, or with no
 * matching subfolder) is silently left where it is — never blocks the
 * kanban move itself, which is the DB update in moveBatchStatus.
 */
async function relocateBatchFilesInDrive(batchId: string, newStatus: VideoStage): Promise<void> {
  const keyword = STAGE_SUBFOLDER_KEYWORD[newStatus];
  if (!keyword) return;

  const videos = await prisma.video.findMany({
    where: { batchId, driveFileId: { not: null }, driveInternalPlatformFolderId: { not: null } },
    select: { driveFileId: true, driveInternalPlatformFolderId: true },
  });
  if (videos.length === 0) return;

  const targetFolderCache = new Map<string, string | null>();

  for (const video of videos) {
    const platformFolderId = video.driveInternalPlatformFolderId!;
    if (!targetFolderCache.has(platformFolderId)) {
      try {
        const siblings = await listDriveFolderChildren(platformFolderId);
        const match = siblings.find((f) => f.isFolder && f.name.toUpperCase().includes(keyword));
        targetFolderCache.set(platformFolderId, match?.id ?? null);
      } catch (err) {
        console.error(`[relocateBatchFilesInDrive] failed to list platform folder ${platformFolderId}:`, err);
        targetFolderCache.set(platformFolderId, null);
      }
    }
    const targetFolderId = targetFolderCache.get(platformFolderId);
    if (!targetFolderId) continue;

    try {
      const parents = await getFileParents(video.driveFileId!);
      const currentParent = parents[0];
      if (!currentParent || currentParent === targetFolderId) continue;
      await moveDriveFile(video.driveFileId!, currentParent, targetFolderId);
    } catch (err) {
      console.error(`[relocateBatchFilesInDrive] failed to move file ${video.driveFileId}:`, err);
    }
  }
}

/**
 * Moves an entire batch (and every Video in it) to a new stage in one go —
 * the "à la chaîne" unit is the block, not the individual video. Fires one
 * activity log entry + one Telegram notification for the whole block when it
 * reaches PRET_POUR_REVIEW, instead of one per video.
 */
export async function moveBatchStatus(batchId: string, newStatus: VideoStage) {
  const batch = await prisma.editingBatch.findUnique({
    where: { id: batchId },
    include: { model: { select: { name: true, driveInternalFolderId: true } }, _count: { select: { videos: true } } },
  });
  if (!batch) return null;

  const updated = await prisma.editingBatch.update({ where: { id: batchId }, data: { status: newStatus } });
  await prisma.video.updateMany({ where: { batchId }, data: { stage: newStatus, stageUpdatedAt: new Date() } });
  await relocateBatchFilesInDrive(batchId, newStatus);

  await activityRepository.log({
    eventType: "VIDEO_STAGE_CHANGED",
    message: `Bloc déplacé vers ${newStatus === "EN_EDITION" ? "En édition" : newStatus === "PRET_POUR_REVIEW" ? "Prêt pour review" : "À éditer"} — ${batch.model.name} (${batch.weekLabel}, ${batch._count.videos} vidéos)`,
    severity: "OK",
    modelId: batch.modelId,
    agencyId: batch.agencyId,
  });

  if (newStatus === "PRET_POUR_REVIEW") {
    const link = batch.model.driveInternalFolderId ? `\nhttps://drive.google.com/drive/folders/${batch.model.driveInternalFolderId}` : "";
    const message = `🎬 <b>Bloc prêt pour review</b> — ${batch.model.name} (${batch.weekLabel}, ${batch._count.videos} vidéos)${link}`;
    try {
      await sendTelegramMessage(message);
    } catch (err) {
      console.error("[moveBatchStatus] telegram notification failed:", err);
    }
  }

  return updated;
}

export async function updateBatchNote(batchId: string, note: string) {
  return prisma.editingBatch.update({ where: { id: batchId }, data: { note: note || null } });
}
