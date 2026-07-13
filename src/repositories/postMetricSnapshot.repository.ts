import { prisma } from "@/lib/prisma";

export const postMetricSnapshotRepository = {
  create(data: {
    postId: string;
    views: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    reach: number;
    engagement: number;
  }) {
    return prisma.postMetricSnapshot.create({ data });
  },

  latestForPost(postId: string) {
    return prisma.postMetricSnapshot.findFirst({
      where: { postId },
      orderBy: { checkedAt: "desc" },
    });
  },

  findSince(since: Date, platform?: string) {
    return prisma.postMetricSnapshot.findMany({
      where: {
        checkedAt: { gte: since },
        ...(platform ? { post: { platform: platform as never } } : {}),
      },
      include: { post: { include: { video: true } } },
      orderBy: { checkedAt: "desc" },
    });
  },
};
