import { prisma } from "@/lib/prisma";
import type { IntegrationStatus, IntegrationType, Prisma } from "@prisma/client";

export const integrationRepository = {
  findMany() {
    return prisma.integration.findMany({ orderBy: { label: "asc" } });
  },
  updateStatus(type: IntegrationType, status: IntegrationStatus, extra?: Partial<{ lastError: string; lastSyncAt: Date }>) {
    return prisma.integration.update({ where: { type }, data: { status, ...extra } });
  },
  update(id: string, data: Prisma.IntegrationUpdateInput) {
    return prisma.integration.update({ where: { id }, data });
  },
  upsert(type: IntegrationType, data: Prisma.IntegrationCreateInput) {
    return prisma.integration.upsert({ where: { type }, create: data, update: data });
  },
};
