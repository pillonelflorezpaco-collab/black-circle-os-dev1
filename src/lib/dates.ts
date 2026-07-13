export type Period = "today" | "week" | "month" | "year";

/** Returns the [start, end) UTC range for a given period, anchored to now. */
export function periodRange(period: Period, now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(now);

  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "year":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start, end };
}

/** The equivalent-length prior period, for computing a "+X% vs période précédente" delta. */
export function previousPeriodRange(period: Period, now: Date = new Date()): { start: Date; end: Date } {
  const { start: currentStart } = periodRange(period, now);
  const { start, end } = periodRange(period, currentStart);
  return { start, end };
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
