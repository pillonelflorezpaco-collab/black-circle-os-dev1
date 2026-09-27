import { prisma } from "@/lib/prisma";
import type { Prisma, VideoStage } from "@prisma/client";

export const videoRepository = {
  findAllGroupedByStage(agencyId: string | null, modelId?: string | null) {
    return prisma.video.findMany({
      where: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { modelId } : {}) },
      include: {
        model: { select: { id: true, name: true } },
        assignedEditor: { select: { id: true, name: true } },
        lastEditedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.video.findUnique({
      where: { id },
      include: { model: true, assignedEditor: true, posts: true },
    });
  },

  create(data: Prisma.VideoCreateInput) {
    return prisma.video.create({ data });
  },

  updateStage(id: string, stage: VideoStage) {
    return prisma.video.update({
      where: { id },
      data: { stage, stageUpdatedAt: new Date() },
    });
  },

  update(id: string, data: Prisma.VideoUpdateInput) {
    return prisma.video.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.video.delete({ where: { id } });
  },

  /** Days of unpublished content left for a model, used by the "contenu restant" gauges. */
  countByModelAndStage(modelId: string) {
    return prisma.video.groupBy({
      by: ["stage"],
      where: { modelId },
      _count: true,
    });
  },
};
