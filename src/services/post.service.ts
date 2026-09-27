import { postRepository } from "@/repositories/post.repository";

export const PLATFORM_COLOR: Record<string, string> = {
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

export async function getCalendarMonth(year: number, month: number, agencyId: string | null, modelId?: string | null) {
  const posts = await postRepository.findByMonth(year, month, agencyId, modelId);
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

export async function listModelPosts(modelId: string) {
  const posts = await postRepository.findMany({ video: { modelId } });
  return posts.map((p) => ({
    id: p.id,
    videoTitle: p.video.title,
    platform: p.platform,
    status: p.status,
    scheduledTime: p.scheduledTime,
    publicUrl: p.publicUrl,
  }));
}
