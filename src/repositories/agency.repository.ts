import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Not agencyId-scoped by design — this repository operates ABOVE the tenant
// boundary. Callers must gate access with assertCan(role, "voirAgences"/"gererAgences")
// (Super Admin only) before calling any of these.
export const agencyRepository = {
  findMany() {
    return prisma.agency.findMany({
      include: { _count: { select: { models: true, users: true, teams: true } } },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.agency.findUnique({
      where: { id },
      include: { teams: true, _count: { select: { models: true, users: true } } },
    });
  },

  create(data: Prisma.AgencyCreateInput) {
    return prisma.agency.create({ data });
  },

  update(id: string, data: Prisma.AgencyUpdateInput) {
    return prisma.agency.update({ where: { id }, data });
  },
};
