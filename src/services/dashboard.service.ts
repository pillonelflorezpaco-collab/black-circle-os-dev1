import { prisma } from "@/lib/prisma";
import { activityRepository } from "@/repositories/activity.repository";
import { periodRange, previousPeriodRange, formatDeltaLabel, type Period, type DateRange } from "@/lib/dates";
import { computeDaysRemaining } from "@/lib/contentStock";

export async function getDashboardData(period: Period, agencyId: string | null, modelId?: string | null, customRange?: DateRange) {
  const { start, end } = periodRange(period, undefined, customRange);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(period, undefined, customRange);
  const agencyFilter = agencyId ? { agencyId } : {};
  const modelFilter = modelId ? { video: { modelId } } : {};
  const videoModelFilter = modelId ? { modelId } : {};

  const [
    activeModels,
    publishedThisPeriod,
    publishedPrevPeriod,
    scheduledCount,
    editingCount,
    reviewCount,
    errorCount,
    models,
    activity,
  ] = await Promise.all([
    modelId ? Promise.resolve(1) : prisma.model.count({ where: agencyFilter }),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: start, lt: end }, ...agencyFilter, ...modelFilter } }),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: prevStart, lt: prevEnd }, ...agencyFilter, ...modelFilter } }),
    prisma.post.count({ where: { status: "SCHEDULED", ...agencyFilter, ...modelFilter } }),
    prisma.video.count({ where: { stage: "EN_EDITION", ...agencyFilter, ...videoModelFilter } }),
    prisma.video.count({ where: { stage: "PRET_POUR_REVIEW", ...agencyFilter, ...videoModelFilter } }),
    prisma.post.count({ where: { status: "FAILED", ...agencyFilter, ...modelFilter } }),
    prisma.model.findMany({
      where: { ...agencyFilter, ...(modelId ? { id: modelId } : {}) },
      include: { videos: { select: { stage: true, stageUpdatedAt: true } } },
      orderBy: { name: "asc" },
    }),
    activityRepository.findRecent(6, agencyId, modelId),
  ]);

  const contentRemaining = models.map((m) => ({
    id: m.id,
    name: m.name,
    days: computeDaysRemaining(m.videos),
  }));

  // 30-day daily published-video trend, real data.
  const since = new Date(Date.now() - 29 * 86_400_000);
  const recentPublished = await prisma.post.findMany({
    where: { status: "PUBLISHED", updatedAt: { gte: since }, ...agencyFilter, ...modelFilter },
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
    heroDeltaLabel: formatDeltaLabel(publishedThisPeriod, publishedPrevPeriod),
    tiles: {
      activeModels,
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
    contentRemaining,
    trend,
  };
}
