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

  addAssignment(modelId: string, userId: string) {
    return prisma.modelAssignment.create({ data: { modelId, userId } });
  },

  findAssignmentById(id: string) {
    return prisma.modelAssignment.findUnique({ where: { id }, include: { model: true } });
  },

  removeAssignment(id: string) {
    return prisma.modelAssignment.delete({ where: { id } });
  },

  addSocialAccountAccess(data: { modelId: string; platform: Prisma.SocialAccountCreateInput["platform"]; displayName: string | null; isMotherAccount: boolean; loginIdentifier: string | null; loginPasswordEnc: string | null }) {
    return prisma.socialAccount.create({
      data: {
        model: { connect: { id: data.modelId } },
        platform: data.platform,
        displayName: data.displayName,
        isMotherAccount: data.isMotherAccount,
        loginIdentifier: data.loginIdentifier,
        loginPasswordEnc: data.loginPasswordEnc,
      },
    });
  },

  findSocialAccountById(id: string) {
    return prisma.socialAccount.findUnique({ where: { id }, include: { model: true } });
  },

  removeSocialAccount(id: string) {
    return prisma.socialAccount.delete({ where: { id } });
  },
};
