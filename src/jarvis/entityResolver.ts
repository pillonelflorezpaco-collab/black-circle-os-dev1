import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import type { ResolvedEntity } from "./types";

// Platform names (Instagram, TikTok, ...) are frequently capitalized in a
// request but refer to a tool/platform, not a Model — excluded from
// candidate extraction so they don't get mistaken for an unresolved entity.
const PLATFORM_NAMES = new Set(Object.values(Platform).map((p) => p.toLowerCase()));

export type EntityResolutionResult =
  | { status: "RESOLVED"; entities: ResolvedEntity[] }
  | { status: "NOT_ATTEMPTED" } // message referenced no candidate proper noun
  | { status: "NOT_FOUND"; candidate: string }
  | { status: "AMBIGUOUS"; candidate: string; matchCount: number };

// Common sentence-leading verbs we don't want to mistake for a proper noun
// when they happen to be capitalized as the first word of the message.
const STOPWORDS = new Set(["prepare", "plan", "analyze", "publish", "manage", "create", "generate", "review"]);

function extractCandidateNames(message: string): string[] {
  const words = message.split(/\s+/);
  const candidates: string[] = [];

  words.forEach((word, index) => {
    const cleaned = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (!cleaned || cleaned.length < 2) return;
    if (index === 0) return; // leading word is usually an imperative verb, not a name
    if (!/^[A-ZÀ-Þ]/.test(cleaned)) return;
    if (STOPWORDS.has(cleaned.toLowerCase())) return;
    if (PLATFORM_NAMES.has(cleaned.toLowerCase())) return;
    candidates.push(cleaned);
  });

  return [...new Set(candidates)];
}

/**
 * Resolves a Model referenced by name in the message, scoped to the
 * requesting agency. Exact (case-insensitive) match only — never fuzzy —
 * so a misspelled or different name correctly falls through to NOT_FOUND
 * instead of guessing.
 */
export async function resolveEntities(message: string, agencyId: string): Promise<EntityResolutionResult> {
  const candidates = extractCandidateNames(message);
  if (candidates.length === 0) {
    return { status: "NOT_ATTEMPTED" };
  }

  for (const candidate of candidates) {
    const matches = await prisma.model.findMany({
      where: { agencyId, name: { equals: candidate, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (matches.length === 1) {
      return { status: "RESOLVED", entities: [{ type: "model", id: matches[0].id, name: matches[0].name }] };
    }
    if (matches.length > 1) {
      return { status: "AMBIGUOUS", candidate, matchCount: matches.length };
    }
  }

  return { status: "NOT_FOUND", candidate: candidates[0] };
}
