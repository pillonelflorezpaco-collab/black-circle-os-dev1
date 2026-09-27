import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const modelRepository = {
  findMany(agencyId?: string | null) {
    return prisma.model.findMany({
      where: agencyId ? { agencyId } : undefined,
      include: { team: true, socialAccounts: true, videos: { select: { id: true, stage: true } } },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.model.findUnique({
      where: { id },
      include: {
        team: true,
        socialAccounts: true,
        videos: true,
        blotatoAccount: true,
        links: { orderBy: { createdAt: "asc" } },
        assignments: { include: { user: true }, orderBy: { createdAt: "asc" } },
        platformConnections: true,
      },
    });
  },

  create(data: Prisma.ModelCreateInput) {
    return prisma.model.create({ data });
  },

  update(id: string, data: Prisma.ModelUpdateInput) {
    return prisma.model.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.model.delete({ where: { id } });
  },

  updateNotes(id: string, notes: string) {
    return prisma.model.update({ where: { id }, data: { notes } });
  },

  addLink(modelId: string, label: string, url: string) {
    return prisma.modelLink.create({ data: { modelId, label, url } });
  },

  findLinkById(id: string) {
    return prisma.modelLink.findUnique({ where: { id }, include: { model: true } });
  },

  removeLink(id: string) {
    return prisma.modelLink.delete({ where: { id } });
  },

  addAssignment(modelId: string, userId: string) {
    return prisma.modelAssignment.create({ data: { modelId, userId } });
  },

  findAssignmentById(id: string) {
    return prisma.modelAssignment.findUnique({ where: { id }, include: { model: true } });
  },

  removeAssignment(id: string) {
    return prisma.modelAssignment.delete({ where: { id } });
  },
};
