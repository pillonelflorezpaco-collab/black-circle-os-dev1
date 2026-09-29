import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const executionRepository = {
  create(data: Prisma.ExecutionCreateInput) {
    return prisma.execution.create({ data });
  },

  findById(id: string) {
    return prisma.execution.findUnique({ where: { id } });
  },

  findByTaskAndIdempotencyKey(taskId: string, idempotencyKey: string) {
    return prisma.execution.findUnique({ where: { taskId_idempotencyKey: { taskId, idempotencyKey } } });
  },

  update(id: string, data: Prisma.ExecutionUpdateInput) {
    return prisma.execution.update({ where: { id }, data });
  },
};
