import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const clientRepository = {
  findMany() {
    return prisma.client.findMany({
      include: { team: true, socialAccounts: true, videos: { select: { id: true, stage: true } } },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: { team: true, socialAccounts: true, videos: true, blotatoAccount: true },
    });
  },

  create(data: Prisma.ClientCreateInput) {
    return prisma.client.create({ data });
  },

  update(id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.client.delete({ where: { id } });
  },
};
