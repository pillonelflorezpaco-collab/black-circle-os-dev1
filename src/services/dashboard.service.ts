import { prisma } from "@/lib/prisma";
import { activityRepository } from "@/repositories/activity.repository";
import { periodRange, previousPeriodRange, percentDelta, type Period } from "@/lib/dates";

export async function getDashboardData(period: Period) {
  const { start, end } = periodRange(period);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(period);

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
    prisma.client.count(),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: start, lt: end } } }),
    prisma.post.count({ where: { status: "PUBLISHED", updatedAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.post.count({ where: { status: "SCHEDULED" } }),
    prisma.video.count({ where: { stage: "EN_EDITION" } }),
    prisma.video.count({ where: { stage: "PRET_POUR_REVIEW" } }),
    prisma.post.count({ where: { status: "FAILED" } }),
    prisma.client.findMany({
      include: { videos: { select: { stage: true, stageUpdatedAt: true } } },
      orderBy: { name: "asc" },
    }),
    activityRepository.findRecent(6),
  ]);

  const delta = percentDelta(publishedThisPeriod, publishedPrevPeriod);

  // "Contenu restant" — days of unpublished content per client, approximated from
  // how many videos are queued (RAW..PROGRAMME) vs. how many publish per week.
  const contentRemaining = clients.map((c) => {
    const queued = c.videos.filter((v) => v.stage !== "PUBLIE").length;
    const days = Math.max(0.5, queued * 1.8); // placeholder cadence until real publish-rate data accrues
    return { id: c.id, name: c.name, days: Math.round(days * 10) / 10 };
  });

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
  };
}
