import { prisma } from "@/lib/prisma";

export const deviceServerRepository = {
  findMany(agencyId?: string | null) {
    return prisma.deviceServer.findMany({
      where: agencyId ? { agencyId } : undefined,
      include: { devices: { select: { id: true, status: true } } },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.deviceServer.findUnique({
      where: { id },
      include: { devices: true },
    });
  },
};
