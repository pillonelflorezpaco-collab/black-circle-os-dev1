import { prisma } from "@/lib/prisma";
import { periodRange, previousPeriodRange, percentDelta, type Period } from "@/lib/dates";

export async function getAnalyticsSummary(period: Period) {
  const { start, end } = periodRange(period);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(period);

  const [snapshots, prevSnapshots] = await Promise.all([
    prisma.postMetricSnapshot.findMany({ where: { checkedAt: { gte: start, lt: end } } }),
    prisma.postMetricSnapshot.findMany({ where: { checkedAt: { gte: prevStart, lt: prevEnd } } }),
  ]);

  const sum = (list: typeof snapshots, key: keyof (typeof snapshots)[number]) =>
    list.reduce((acc, s) => acc + (s[key] as number), 0);

  const views = sum(snapshots, "views");
  const prevViews = sum(prevSnapshots, "views");
  const likes = sum(snapshots, "likes");
  const comments = sum(snapshots, "comments");
  const shares = sum(snapshots, "shares");
  const reach = sum(snapshots, "reach");
  const engagementRate = reach > 0 ? Math.round(((likes + comments + shares) / reach) * 1000) / 10 : 0;

  return {
    views,
    delta: percentDelta(views, prevViews),
    likes,
    comments,
    shares,
    reach,
    engagementRate,
  };
}

export async function getTopVideos(limit = 5) {
  const snapshots = await prisma.postMetricSnapshot.findMany({
    include: { post: { include: { video: { include: { client: true } } } } },
    orderBy: { views: "desc" },
    take: limit,
  });
  return snapshots.map((s) => ({
    title: s.post.video.title,
    platform: s.post.platform,
    views: s.views,
    likes: s.likes,
  }));
}

const DAYPARTS = [
  { label: "06–11h", from: 6, to: 11 },
  { label: "11–15h", from: 11, to: 15 },
  { label: "15–19h", from: 15, to: 19 },
  { label: "19–23h", from: 19, to: 23 },
];

/** Real aggregation from seeded snapshots — sparse with little data, fills in as more posts accrue. */
export async function getBestHoursHeatmap() {
  const snapshots = await prisma.postMetricSnapshot.findMany({
    include: { post: { select: { scheduledTime: true } } },
  });

  const grid = Array.from({ length: DAYPARTS.length }, () => Array(7).fill(0));
  for (const s of snapshots) {
    const d = new Date(s.post.scheduledTime);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const hour = d.getUTCHours();
    const partIdx = DAYPARTS.findIndex((p) => hour >= p.from && hour < p.to);
    if (partIdx === -1) continue;
    grid[partIdx][dow] += s.likes + s.comments + s.shares;
  }
  return { dayparts: DAYPARTS.map((p) => p.label), grid };
}

export async function getPlatformBreakdown() {
  const grouped = await prisma.post.groupBy({
    by: ["platform"],
    where: { status: "PUBLISHED" },
    _count: true,
  });
  return grouped
    .map((g) => ({ platform: g.platform, count: g._count }))
    .sort((a, b) => b.count - a.count);
}
