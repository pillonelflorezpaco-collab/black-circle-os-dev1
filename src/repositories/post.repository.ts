import { prisma } from "@/lib/prisma";
import type { Prisma, PostStatus } from "@prisma/client";

export const postRepository = {
  findMany(where?: Prisma.PostWhereInput) {
    return prisma.post.findMany({
      where,
      include: { video: { include: { model: true } }, socialAccount: true },
      orderBy: { scheduledTime: "asc" },
    });
  },

  findById(id: string) {
    return prisma.post.findUnique({
      where: { id },
      include: { video: { include: { model: true } }, socialAccount: true, metricSnapshots: true },
    });
  },

  findByMonth(year: number, month: number, agencyId: string | null, modelId?: string | null) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return prisma.post.findMany({
      where: {
        scheduledTime: { gte: start, lt: end },
        ...(agencyId ? { agencyId } : {}),
        ...(modelId ? { video: { modelId } } : {}),
      },
      include: { video: { select: { title: true, modelId: true } } },
      orderBy: { scheduledTime: "asc" },
    });
  },

  findPending() {
    return prisma.post.findMany({
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    });
  },

  create(data: Prisma.PostCreateInput) {
    return prisma.post.create({ data });
  },

  updateStatus(id: string, status: PostStatus, extra?: Partial<{ publicUrl: string; errorMessage: string; postSubmissionId: string }>) {
    return prisma.post.update({ where: { id }, data: { status, ...extra } });
  },

  delete(id: string) {
    return prisma.post.delete({ where: { id } });
  },
};
