import { prisma } from "@/lib/prisma";
import type { ActivityEventType, ActivitySeverity, Prisma } from "@prisma/client";

export const activityRepository = {
  findRecent(limit = 20) {
    return prisma.activityLogEntry.findMany({
      include: { client: { select: { id: true, name: true } }, actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  log(entry: {
    eventType: ActivityEventType;
    message: string;
    severity?: ActivitySeverity;
    clientId?: string;
    actorId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.activityLogEntry.create({ data: entry });
  },
};
