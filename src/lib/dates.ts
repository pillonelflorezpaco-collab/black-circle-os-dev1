export type Period = "today" | "week" | "month" | "year" | "custom";

export type DateRange = { start: Date; end: Date };

/**
 * Returns the [start, end) UTC range for a given period, anchored to now.
 * For "custom", `custom` supplies the exact range (falls back to the last
 * month if omitted, e.g. before the user has picked both dates yet).
 */
export function periodRange(period: Period, now: Date = new Date(), custom?: DateRange): DateRange {
  if (period === "custom" && custom) return custom;

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
    case "custom":
      start.setMonth(start.getMonth() - 1);
      break;
    case "year":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start, end };
}

/** The equivalent-length prior period, for computing a "+X% vs période précédente" delta. */
export function previousPeriodRange(period: Period, now: Date = new Date(), custom?: DateRange): DateRange {
  const { start: currentStart, end: currentEnd } = periodRange(period, now, custom);

  if (period === "custom" && custom) {
    const lengthMs = currentEnd.getTime() - currentStart.getTime();
    return { start: new Date(currentStart.getTime() - lengthMs), end: currentStart };
  }

  const { start, end } = periodRange(period, currentStart);
  return { start, end };
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Renders a "+X% vs période précédente" label. When the previous period had
 * zero to compare against, a literal percentage is meaningless (going from 0
 * to 1 is not "+100%" any more than going from 0 to 1000 is) — say so
 * explicitly instead of printing a flat, misleading "+100%".
 */
export function formatDeltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? "Nouveau — pas de donnée période préc." : "Pas de donnée période préc.";
  }
  const delta = percentDelta(current, previous);
  return `${delta >= 0 ? "+" : ""}${delta}% vs période préc.`;
}
