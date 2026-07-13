import { prisma } from "@/lib/prisma";
import type { Prisma, ReportStatus } from "@prisma/client";

export const reportRepository = {
  findMany() {
    return prisma.report.findMany({ orderBy: { createdAt: "desc" } });
  },
  findById(id: string) {
    return prisma.report.findUnique({ where: { id } });
  },
  create(data: Prisma.ReportCreateInput) {
    return prisma.report.create({ data });
  },
  updateStatus(id: string, status: ReportStatus, extra?: Partial<{ fileUrl: string; sizeBytes: number; completedAt: Date }>) {
    return prisma.report.update({ where: { id }, data: { status, ...extra } });
  },
  delete(id: string) {
    return prisma.report.delete({ where: { id } });
  },
};
