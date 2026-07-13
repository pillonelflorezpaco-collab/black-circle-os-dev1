import { postRepository } from "@/repositories/post.repository";

const PLATFORM_COLOR: Record<string, string> = {
  INSTAGRAM: "#C68F5A",
  TIKTOK: "#7FA3C4",
  YOUTUBE: "#C1604A",
  FACEBOOK: "#7F93C4",
  PINTEREST: "#C1604A",
  LINKEDIN: "#7FA3C4",
  TWITTER: "#8C8A85",
  THREADS: "#8C8A85",
  BLUESKY: "#7FA3C4",
};

export async function getCalendarMonth(year: number, month: number, clientId?: string | null) {
  const posts = await postRepository.findByMonth(year, month, clientId);
  const byDay = new Map<number, { platform: string; color: string; title: string }[]>();

  for (const post of posts) {
    const day = new Date(post.scheduledTime).getUTCDate();
    const list = byDay.get(day) ?? [];
    list.push({
      platform: post.platform,
      color: PLATFORM_COLOR[post.platform] ?? "#8C8A85",
      title: post.video.title,
    });
    byDay.set(day, list);
  }

  return byDay;
}
