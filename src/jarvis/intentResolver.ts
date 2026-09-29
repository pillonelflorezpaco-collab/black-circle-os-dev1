import type { IntentKey, ResolvedIntent } from "./types";

// Deterministic keyword resolver — a placeholder for a future LLM reasoning
// layer. Kept as a single exported function with a stable signature
// (string in, ResolvedIntent | null out) so it can be swapped or augmented
// later without touching the rest of the pipeline.
const INTENT_KEYWORDS: Record<IntentKey, string[]> = {
  content_planning: ["content plan", "content strategy", "plan my content", "plan content"],
  content_analysis: ["analyze content", "content performance", "content analysis"],
  social_media_management: ["social media", "manage instagram", "manage tiktok", "publish on instagram", "publish on tiktok"],
  marketing_strategy: ["marketing strategy", "marketing plan"],
};

export function resolveIntent(message: string): ResolvedIntent | null {
  const normalized = message.toLowerCase();

  for (const [type, keywords] of Object.entries(INTENT_KEYWORDS) as [IntentKey, string[]][]) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return { type, confidence: 0.6 };
    }
  }

  return null;
}
