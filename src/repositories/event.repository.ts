import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const eventRepository = {
  create(data: Prisma.EventCreateInput) {
    return prisma.event.create({ data });
  },

  findMany(agencyId?: string | null, take = 100) {
    return prisma.event.findMany({
      where: agencyId ? { agencyId } : undefined,
      include: {
        deviceServer: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  },
};
