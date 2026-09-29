import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const executionStepRepository = {
  create(data: Prisma.ExecutionStepCreateInput) {
    return prisma.executionStep.create({ data });
  },

  update(id: string, data: Prisma.ExecutionStepUpdateInput) {
    return prisma.executionStep.update({ where: { id }, data });
  },

  findFirstForExecution(executionId: string) {
    return prisma.executionStep.findFirst({ where: { executionId }, orderBy: { sequence: "asc" } });
  },
};
