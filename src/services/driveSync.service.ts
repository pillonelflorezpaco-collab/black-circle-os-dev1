import { prisma } from "@/lib/prisma";
import { listDriveFolderChildren, moveDriveFile } from "@/lib/googleDrive";
import { activityRepository } from "@/repositories/activity.repository";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Daily Drive → BlackOS sync: detects new files the models have uploaded
 * into their public "Model OF" Drive folder, physically moves each one into
 * the matching platform folder of the internal mirror (the service account
 * has Editor access on both, granted 2026-09-30), and imports it as a Video
 * row (stage A_EDITER) so it shows up on the Espace Éditrice page and
 * notifies the assigned editor.
 *
 * The public folder's subfolders are named "1 — ONLYFANS"/"2 — NORMAL"/
 * "3 — REELS"; the internal mirror's are named per platform too (e.g.
 * "ONLYFANS — POSTEADO"), not identically — matched by the platform keyword
 * they share (see matchInternalFolder). If a model's internal mirror has no
 * folder for a given platform, the file is still imported as a Video (so
 * it's not lost from tracking) but left in place in Drive; this is logged
 * so the gap in that model's folder structure can be fixed by hand.
 */

const PLATFORM_KEYWORDS = ["ONLYFANS", "NORMAL", "REELS"];

function platformKeywordIn(name: string): string | null {
  const upper = name.toUpperCase();
  return PLATFORM_KEYWORDS.find((kw) => upper.includes(kw)) ?? null;
}

function currentWeekLabel(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `Semaine ${week} ${now.getFullYear()}`;
}

async function findAssignedEditorId(modelId: string): Promise<string | null> {
  const assignment = await prisma.modelAssignment.findFirst({
    where: { modelId, user: { role: "VIDEO_EDITOR" } },
    select: { userId: true },
  });
  return assignment?.userId ?? null;
}

/**
 * Finds this model/week/editor's kanban block, creating it if this is the
 * first file synced into it. Uses findFirst+create rather than upsert on the
 * compound unique key — that key includes the nullable assignedEditorId,
 * and a plain findFirst avoids relying on how the DB driver normalizes NULL
 * inside a compound-unique WHERE.
 */
async function findOrCreateBatch(modelId: string, agencyId: string, editorId: string | null, weekLabel: string) {
  const existing = await prisma.editingBatch.findFirst({ where: { modelId, weekLabel, assignedEditorId: editorId } });
  if (existing) return existing;
  return prisma.editingBatch.create({ data: { modelId, agencyId, assignedEditorId: editorId, weekLabel, status: "A_EDITER" } });
}

export async function syncDriveContentForAllModels(): Promise<{ modelsScanned: number; videosCreated: number; filesMoved: number }> {
  const models = await prisma.model.findMany({
    where: { driveFolderId: { not: null } },
    select: { id: true, name: true, agencyId: true, driveFolderId: true, driveInternalFolderId: true },
  });

  let videosCreated = 0;
  let filesMoved = 0;
  const weekLabel = currentWeekLabel();

  for (const model of models) {
    let subfolders;
    try {
      subfolders = await listDriveFolderChildren(model.driveFolderId!);
    } catch (err) {
      console.error(`[driveSync] failed to list root folder for ${model.name}:`, err);
      continue;
    }

    let internalSubfolders: Awaited<ReturnType<typeof listDriveFolderChildren>> = [];
    if (model.driveInternalFolderId) {
      try {
        internalSubfolders = await listDriveFolderChildren(model.driveInternalFolderId);
      } catch (err) {
        console.error(`[driveSync] failed to list internal folder for ${model.name}:`, err);
      }
    }

    let newForModel = 0;
    for (const sub of subfolders.filter((f) => f.isFolder)) {
      let files;
      try {
        files = await listDriveFolderChildren(sub.id);
      } catch (err) {
        console.error(`[driveSync] failed to list "${sub.name}" for ${model.name}:`, err);
        continue;
      }

      const keyword = platformKeywordIn(sub.name);
      const internalTarget = keyword ? internalSubfolders.find((f) => f.isFolder && platformKeywordIn(f.name) === keyword) : undefined;

      for (const file of files.filter((f) => !f.isFolder)) {
        const existing = await prisma.video.findFirst({ where: { driveFileId: file.id } });
        if (existing) continue;

        if (internalTarget) {
          try {
            await moveDriveFile(file.id, sub.id, internalTarget.id);
            filesMoved++;
          } catch (err) {
            console.error(`[driveSync] failed to move "${file.name}" for ${model.name}:`, err);
          }
        } else {
          console.warn(`[driveSync] no internal "${keyword ?? sub.name}" folder found for ${model.name} — file left in place`);
        }

        const assignedEditorId = await findAssignedEditorId(model.id);
        const batch = await findOrCreateBatch(model.id, model.agencyId, assignedEditorId, weekLabel);
        await prisma.video.create({
          data: {
            title: file.name,
            model: { connect: { id: model.id } },
            agency: { connect: { id: model.agencyId } },
            batch: { connect: { id: batch.id } },
            stage: "A_EDITER",
            weekLabel,
            driveFileId: file.id,
            driveInternalPlatformFolderId: internalTarget?.id ?? null,
            driveUrl: file.webViewLink,
            thumbnailUrl: file.thumbnailLink,
            ...(assignedEditorId ? { assignedEditor: { connect: { id: assignedEditorId } } } : {}),
          },
        });
        videosCreated++;
        newForModel++;
      }
    }

    if (newForModel > 0) {
      await activityRepository.log({
        eventType: "VIDEO_STAGE_CHANGED",
        message: `${newForModel} nouveau${newForModel > 1 ? "x" : ""} fichier${newForModel > 1 ? "s" : ""} détecté${newForModel > 1 ? "s" : ""} dans le Drive — ${model.name} (${weekLabel})`,
        severity: "OK",
        modelId: model.id,
        agencyId: model.agencyId,
      });
      await notifyEditorNewFiles(model.id, model.name, newForModel, weekLabel);
    }
  }

  return { modelsScanned: models.length, videosCreated, filesMoved };
}

async function notifyEditorNewFiles(modelId: string, modelName: string, count: number, weekLabel: string) {
  const editorId = await findAssignedEditorId(modelId);
  if (!editorId) return; // no editor assigned yet — activity log entry above is still visible on the model page

  const message = `🎬 <b>${count} nouveau${count > 1 ? "x" : ""} fichier${count > 1 ? "s" : ""} à éditer</b> — ${modelName} (${weekLabel})`;
  try {
    await sendTelegramMessage(message);
  } catch (err) {
    console.error("[driveSync] telegram notification failed:", err);
  }
}
