import type { Platform } from "@prisma/client";

/**
 * Maps our Prisma `Platform` enum to Blotato's own lowercase wire values
 * (used as both `content.platform` and `target.targetType` in their API).
 * Never invent our own platform slugs — always go through this table.
 */
export const PLATFORM_TO_BLOTATO: Record<Platform, string> = {
  INSTAGRAM: "instagram",
  YOUTUBE: "youtube",
  FACEBOOK: "facebook",
  PINTEREST: "pinterest",
  THREADS: "threads",
  TWITTER: "twitter",
  LINKEDIN: "linkedin",
  TIKTOK: "tiktok",
  BLUESKY: "bluesky",
};

const BLOTATO_TO_PLATFORM: Record<string, Platform> = Object.fromEntries(
  Object.entries(PLATFORM_TO_BLOTATO).map(([platform, wire]) => [wire, platform as Platform])
);

export function platformToBlotato(platform: Platform): string {
  return PLATFORM_TO_BLOTATO[platform];
}

export function blotatoToPlatform(wire: string): Platform {
  const platform = BLOTATO_TO_PLATFORM[wire.toLowerCase()];
  if (!platform) {
    throw new Error(`Unknown Blotato platform value: "${wire}"`);
  }
  return platform;
}

/** Platforms Blotato's analytics endpoint actually covers (per post-tracker/config.py.example). */
export const ANALYTICS_SUPPORTED_PLATFORMS: Platform[] = [
  "INSTAGRAM",
  "TWITTER",
  "FACEBOOK",
  "THREADS",
  "BLUESKY",
];
