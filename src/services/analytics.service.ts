import { prisma } from "@/lib/prisma";
import { periodRange, previousPeriodRange, formatDeltaLabel, type Period, type DateRange } from "@/lib/dates";

export async function getAnalyticsSummary(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange) {
  const { start, end } = periodRange(period, undefined, customRange);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(period, undefined, customRange);
  const postFilter = { post: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) } };

  const [snapshots, prevSnapshots] = await Promise.all([
    prisma.postMetricSnapshot.findMany({ where: { checkedAt: { gte: start, lt: end }, ...postFilter } }),
    prisma.postMetricSnapshot.findMany({ where: { checkedAt: { gte: prevStart, lt: prevEnd }, ...postFilter } }),
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
    deltaLabel: formatDeltaLabel(views, prevViews),
    likes,
    comments,
    shares,
    reach,
    engagementRate,
  };
}

// Same latest-snapshot-per-post dedup as getViewsByAccount below — the
// snapshot table is append-only, so a post tracked over time accumulates
// multiple rows and picking straight from raw rows would let one popular
// video crowd the "top" list with several of its own snapshots.
export async function getTopVideos(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange, limit = 5) {
  const { start, end } = periodRange(period, undefined, customRange);
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: { checkedAt: { gte: start, lt: end }, post: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) } },
    include: { post: { include: { video: { include: { model: true } } } } },
    orderBy: { checkedAt: "desc" },
  });

  const latestByPost = new Map<string, (typeof snapshots)[number]>();
  for (const s of snapshots) {
    if (!latestByPost.has(s.postId)) latestByPost.set(s.postId, s);
  }

  return Array.from(latestByPost.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
    .map((s) => ({
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
export async function getBestHoursHeatmap(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange) {
  const { start, end } = periodRange(period, undefined, customRange);
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: { checkedAt: { gte: start, lt: end }, post: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) } },
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

export async function getPlatformBreakdown(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange) {
  const { start, end } = periodRange(period, undefined, customRange);
  const grouped = await prisma.post.groupBy({
    by: ["platform"],
    where: { status: "PUBLISHED", updatedAt: { gte: start, lt: end }, ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) },
    _count: true,
  });
  return grouped
    .map((g) => ({ platform: g.platform, count: g._count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Total views per social account, using the latest snapshot per post (the
 * snapshot table is append-only, so summing every row would double-count).
 * Sorted descending — the simple "who's performing" view models ask about.
 */
export async function getViewsByAccount(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange, limit = 6) {
  const { start, end } = periodRange(period, undefined, customRange);
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: { checkedAt: { gte: start, lt: end }, post: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) } },
    include: { post: { include: { socialAccount: { include: { model: true } } } } },
    orderBy: { checkedAt: "desc" },
  });

  const latestByPost = new Map<string, (typeof snapshots)[number]>();
  for (const s of snapshots) {
    if (!latestByPost.has(s.postId)) latestByPost.set(s.postId, s);
  }

  const byAccount = new Map<string, { accountId: string; platform: string; label: string; views: number }>();
  for (const s of latestByPost.values()) {
    const acc = s.post.socialAccount;
    const existing = byAccount.get(acc.id);
    const label = acc.displayName || acc.model.name;
    if (existing) {
      existing.views += s.views;
    } else {
      byAccount.set(acc.id, { accountId: acc.id, platform: acc.platform, label, views: s.views });
    }
  }

  return Array.from(byAccount.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/** Daily view totals for the trend chart, real data (falls back to a flat zero series with no posts yet). */
export async function getDailyViewSeries(days: number, agencyId: string | null, modelId?: string | null) {
  const since = new Date(Date.now() - days * 86_400_000);
  const snapshots = await prisma.postMetricSnapshot.findMany({
    where: {
      checkedAt: { gte: since },
      post: { ...(agencyId ? { agencyId } : {}), ...(modelId ? { video: { modelId } } : {}) },
    },
    select: { checkedAt: true, views: true },
  });

  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of snapshots) {
    const key = new Date(s.checkedAt).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + s.views);
  }

  return Array.from(byDay.entries()).map(([date, views]) => ({ date, views }));
}
