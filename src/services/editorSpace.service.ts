import { prisma } from "@/lib/prisma";
import type { VideoStage } from "@prisma/client";

const ACTIVE_STAGES: VideoStage[] = ["A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW"];
// Once a video leaves this stage it's counted as "édité" for the accounting view below.
const EDITED_STAGES: VideoStage[] = ["PRET_POUR_REVIEW", "VALIDE", "PROGRAMME", "PUBLIE"];

export interface EditorBatchVideo {
  id: string;
  title: string;
  stage: VideoStage;
  driveUrl: string | null;
  thumbnailUrl: string | null;
  stageUpdatedAt: Date;
}

export interface EditorBatch {
  key: string;
  modelId: string;
  modelName: string;
  weekLabel: string;
  editorId: string | null;
  editorName: string | null;
  videos: EditorBatchVideo[];
}

/**
 * Groups active (not-yet-published) videos into per-model/per-week batches —
 * the unit the Espace Éditrice page works with, mirroring the "Semaine N"
 * tracking already used in ClickUp's "Luz verde" lists.
 *
 * onlyEditorId restricts to one editor's own assigned videos (what a
 * VIDEO_EDITOR sees); omit it to see every editor's batches (what a manager
 * sees).
 */
export async function getEditorSpaceBatches(agencyId: string | null, onlyEditorId?: string): Promise<EditorBatch[]> {
  const videos = await prisma.video.findMany({
    where: {
      ...(agencyId ? { agencyId } : {}),
      stage: { in: ACTIVE_STAGES },
      ...(onlyEditorId ? { assignedEditorId: onlyEditorId } : {}),
    },
    include: {
      model: { select: { id: true, name: true } },
      assignedEditor: { select: { id: true, name: true } },
    },
    orderBy: [{ stageUpdatedAt: "asc" }],
  });

  const batches = new Map<string, EditorBatch>();
  for (const v of videos) {
    const weekLabel = v.weekLabel ?? "Sans semaine";
    const key = `${v.modelId}::${weekLabel}::${v.assignedEditorId ?? "none"}`;
    if (!batches.has(key)) {
      batches.set(key, {
        key,
        modelId: v.modelId,
        modelName: v.model.name,
        weekLabel,
        editorId: v.assignedEditorId,
        editorName: v.assignedEditor?.name ?? null,
        videos: [],
      });
    }
    batches.get(key)!.videos.push({
      id: v.id,
      title: v.title,
      stage: v.stage,
      driveUrl: v.driveUrl,
      thumbnailUrl: v.thumbnailUrl,
      stageUpdatedAt: v.stageUpdatedAt,
    });
  }

  return Array.from(batches.values());
}

/** "Combien de vidéos {éditrice} a-t-elle éditées" — grouped by week, for Jarvis and the manager-facing summary. */
export async function getEditedCountByWeek(editorId: string, agencyId: string | null): Promise<{ weekLabel: string; count: number }[]> {
  const grouped = await prisma.video.groupBy({
    by: ["weekLabel"],
    where: {
      assignedEditorId: editorId,
      stage: { in: EDITED_STAGES },
      ...(agencyId ? { agencyId } : {}),
    },
    _count: true,
    orderBy: { weekLabel: "desc" },
  });
  return grouped.map((g) => ({ weekLabel: g.weekLabel ?? "Sans semaine", count: g._count }));
}

const NEXT_STAGE: Partial<Record<VideoStage, VideoStage>> = {
  A_EDITER: "EN_EDITION",
  EN_EDITION: "PRET_POUR_REVIEW",
};

export function nextEditorStage(current: VideoStage): VideoStage | null {
  return NEXT_STAGE[current] ?? null;
}
