import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const teamRepository = {
  findMany() {
    return prisma.team.findMany({ include: { members: true }, orderBy: { name: "asc" } });
  },
  findById(id: string) {
    return prisma.team.findUnique({ where: { id }, include: { members: true, clients: true } });
  },
  create(data: Prisma.TeamCreateInput) {
    return prisma.team.create({ data });
  },
  update(id: string, data: Prisma.TeamUpdateInput) {
    return prisma.team.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.team.delete({ where: { id } });
  },
};
