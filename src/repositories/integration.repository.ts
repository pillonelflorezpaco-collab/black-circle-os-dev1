import { prisma } from "@/lib/prisma";
import type { IntegrationStatus, IntegrationType, Prisma } from "@prisma/client";

export const integrationRepository = {
  findMany(agencyId: string) {
    return prisma.integration.findMany({ where: { agencyId }, orderBy: { label: "asc" } });
  },
  updateStatus(agencyId: string, type: IntegrationType, status: IntegrationStatus, extra?: Partial<{ lastError: string; lastSyncAt: Date }>) {
    return prisma.integration.update({ where: { agencyId_type: { agencyId, type } }, data: { status, ...extra } });
  },
  update(id: string, data: Prisma.IntegrationUpdateInput) {
    return prisma.integration.update({ where: { id }, data });
  },
  upsert(agencyId: string, type: IntegrationType, data: Prisma.IntegrationCreateInput) {
    return prisma.integration.upsert({ where: { agencyId_type: { agencyId, type } }, create: data, update: data });
  },
};
