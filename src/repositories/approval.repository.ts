import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const approvalRepository = {
  create(data: Prisma.ApprovalCreateInput) {
    return prisma.approval.create({ data });
  },

  findPendingForTask(taskId: string) {
    return prisma.approval.findFirst({ where: { taskId, status: "PENDING" } });
  },

  findById(id: string) {
    return prisma.approval.findUnique({ where: { id }, include: { task: true } });
  },

  update(id: string, data: Prisma.ApprovalUpdateInput) {
    return prisma.approval.update({ where: { id }, data });
  },
};
