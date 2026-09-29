import { prisma } from "@/lib/prisma";

export const deviceRepository = {
  findMany(agencyId?: string | null) {
    return prisma.device.findMany({
      where: agencyId ? { agencyId } : undefined,
      include: {
        deviceServer: { select: { id: true, name: true, status: true } },
        assignedModel: { select: { id: true, name: true } },
        assignedEmployee: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.device.findUnique({
      where: { id },
      include: {
        deviceServer: true,
        assignedModel: { select: { id: true, name: true } },
        assignedEmployee: { select: { id: true, name: true } },
        socialAccounts: { select: { id: true, platform: true, displayName: true } },
      },
    });
  },
};
