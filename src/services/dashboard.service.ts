import { prisma } from "@/lib/prisma";
import { activityRepository } from "@/repositories/activity.repository";
import { periodRange, previousPeriodRange, percentDelta, type Period, type DateRange } from "@/lib/dates";

export async function getDashboardData(period: Period, clientId?: string | null, customRange?: DateRange) {
  const { start, end } = periodRange(period, undefined, customRange);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(period, undefined, customRange);
  const clientFilter = clientId ? { video: { clientId } } : {};
  const videoClientFilter = clientId ? { clientId } : {};

  const [
    activeClients,
    publishedThisPeriod,
    publishedPrevPeriod,
    scheduledCount,
    editingCount,
    reviewCount,
    errorCount,
    clients,
    activity,
  ] = await Promise.all([
    clientId ? Promise.resolve(1) : prisma.client.count(),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: start, lt: end }, ...clientFilter } }),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: prevStart, lt: prevEnd }, ...clientFilter } }),
    prisma.post.count({ where: { status: "SCHEDULED", ...clientFilter } }),
    prisma.video.count({ where: { stage: "EN_EDITION", ...videoClientFilter } }),
    prisma.video.count({ where: { stage: "PRET_POUR_REVIEW", ...videoClientFilter } }),
    prisma.post.count({ where: { status: "FAILED", ...clientFilter } }),
    prisma.client.findMany({
      where: clientId ? { id: clientId } : undefined,
      include: { videos: { select: { stage: true, stageUpdatedAt: true } } },
      orderBy: { name: "asc" },
    }),
    activityRepository.findRecent(6, clientId),
  ]);

  const delta = percentDelta(publishedThisPeriod, publishedPrevPeriod);

  // "Contenu restant" — days of unpublished content per client, approximated from
  // how many videos are queued (RAW..PROGRAMME) vs. how many publish per week.
  const contentRemaining = clients.map((c) => {
    const queued = c.videos.filter((v) => v.stage !== "PUBLIE").length;
    const days = Math.max(0.5, queued * 1.8); // placeholder cadence until real publish-rate data accrues
    return { id: c.id, name: c.name, days: Math.round(days * 10) / 10 };
  });

  // 30-day daily published-video trend, real data.
  const since = new Date(Date.now() - 29 * 86_400_000);
  const recentPublished = await prisma.post.findMany({
    where: { status: "PUBLISHED", updatedAt: { gte: since }, ...clientFilter },
    select: { updatedAt: true },
  });
  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 86_400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of recentPublished) {
    const key = new Date(p.updatedAt).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const trend = Array.from(byDay.entries()).map(([date, count]) => ({
    label: new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: count,
  }));

  return {
    period,
    heroAmount: publishedThisPeriod,
    heroDeltaLabel: `${delta >= 0 ? "+" : ""}${delta}% vs période préc.`,
    tiles: {
      activeClients,
      publishedToday: publishedThisPeriod,
      scheduledCount,
      publishedThisPeriod,
      editingCount,
      reviewCount,
      errorCount,
      avgContentRemainingDays:
        contentRemaining.length > 0
          ? Math.round((contentRemaining.reduce((s, c) => s + c.days, 0) / contentRemaining.length) * 10) / 10
          : 0,
    },
    activity,
    contentRemaining: contentRemaining.slice(0, 4),
    trend,
  };
}
