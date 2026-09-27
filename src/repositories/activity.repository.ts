import { prisma } from "@/lib/prisma";
import type { ActivityEventType, ActivitySeverity, Prisma } from "@prisma/client";

export const activityRepository = {
  findRecent(limit = 20, agencyId: string | null, modelId?: string | null) {
    return prisma.activityLogEntry.findMany({
      where: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { modelId } : {}) },
      include: { model: { select: { id: true, name: true } }, actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  log(entry: {
    eventType: ActivityEventType;
    message: string;
    severity?: ActivitySeverity;
    modelId?: string;
    actorId?: string;
    agencyId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.activityLogEntry.create({ data: entry });
  },
};
