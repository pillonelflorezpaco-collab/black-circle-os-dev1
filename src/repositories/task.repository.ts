import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskRepository = {
  create(data: Prisma.TaskCreateInput) {
    return prisma.task.create({ data });
  },

  findById(id: string) {
    return prisma.task.findUnique({ where: { id } });
  },

  findByAgencyAndRequestId(agencyId: string, requestId: string) {
    return prisma.task.findUnique({ where: { agencyId_requestId: { agencyId, requestId } } });
  },

  update(id: string, data: Prisma.TaskUpdateInput) {
    return prisma.task.update({ where: { id }, data });
  },
};
