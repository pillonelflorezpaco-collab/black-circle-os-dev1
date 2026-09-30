import { prisma } from "@/lib/prisma";
import { listDriveFolderChildren } from "@/lib/googleDrive";
import { activityRepository } from "@/repositories/activity.repository";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Daily Drive → BlackOS sync: detects new files the models have uploaded
 * into their public "Model OF" Drive folder and imports each one as a Video
 * row (stage A_EDITER) so it shows up on the Espace Éditrice page and
 * notifies the assigned editor.
 *
 * Read-only for now — the Drive service account only has the
 * drive.readonly scope, so this does NOT physically move/copy files into
 * the internal Drive folder yet. That needs the service account re-granted
 * with write access before it can be added; until then, BlackOS is the
 * source of truth for "what's new to edit", and the model's own Drive
 * folder stays the actual file location.
 */

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

export async function syncDriveContentForAllModels(): Promise<{ modelsScanned: number; videosCreated: number }> {
  const models = await prisma.model.findMany({
    where: { driveFolderId: { not: null } },
    select: { id: true, name: true, agencyId: true, driveFolderId: true },
  });

  let videosCreated = 0;
  const weekLabel = currentWeekLabel();

  for (const model of models) {
    let subfolders;
    try {
      subfolders = await listDriveFolderChildren(model.driveFolderId!);
    } catch (err) {
      console.error(`[driveSync] failed to list root folder for ${model.name}:`, err);
      continue;
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

      for (const file of files.filter((f) => !f.isFolder)) {
        const existing = await prisma.video.findFirst({ where: { driveFileId: file.id } });
        if (existing) continue;

        const assignedEditorId = await findAssignedEditorId(model.id);
        await prisma.video.create({
          data: {
            title: file.name,
            model: { connect: { id: model.id } },
            agency: { connect: { id: model.agencyId } },
            stage: "A_EDITER",
            weekLabel,
            driveFileId: file.id,
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

  return { modelsScanned: models.length, videosCreated };
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
