// Days of unpublished content per model, approximated from how many videos
// are queued (RAW..PROGRAMME) vs. how many publish per week — placeholder
// cadence until real publish-rate data accrues. Shared by the Dashboard's
// ring gauges and the Models grid/detail page so both stay in sync.
export function computeDaysRemaining(videos: { stage: string }[]): number {
  const queued = videos.filter((v) => v.stage !== "PUBLIE").length;
  return Math.max(0.5, Math.round(queued * 1.8 * 10) / 10);
}
