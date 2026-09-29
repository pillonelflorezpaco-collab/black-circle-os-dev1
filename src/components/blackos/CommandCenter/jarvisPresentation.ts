import type { JarvisPlan } from "@/jarvis/types";

// Pure presentation helpers — no data invented, only relabeling of fields
// Jarvis Core already returned. Shared between the Command Center's Jarvis
// panel and the dedicated /jarvis page so the mapping only lives once.

export function humanizeKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const STATUS_LABELS: Record<JarvisPlan["status"], string> = {
  DRY_RUN: "PLAN READY",
  NEEDS_CLARIFICATION: "NEEDS CLARIFICATION",
  UNKNOWN_INTENT: "INTENT NOT RECOGNIZED",
};

export function statusLabel(status: JarvisPlan["status"]): string {
  return STATUS_LABELS[status] ?? status;
}

// Only covers reason codes Jarvis Core actually emits today (see
// src/jarvis/core.ts) — anything else falls back to the raw reason string
// rather than a fabricated explanation.
const REASON_LABELS: Record<string, string> = {
  MODEL_NOT_FOUND: "The referenced model could not be found in this agency.",
  AMBIGUOUS_MODEL: "More than one model matches that name — please be more specific.",
  ACTOR_NOT_AUTHORIZED_FOR_AGENCY: "This actor is not authorized for the selected agency.",
  NO_MATCHING_CAPABILITY_KEYWORDS: "Jarvis didn't recognize an actionable request in this message.",
  CAPABILITY_NOT_STAFFED: "No agent in the organization currently holds this capability.",
  EMPTY_MESSAGE: "The message was empty.",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function proposedAction(plan: JarvisPlan): string | null {
  if (plan.status !== "DRY_RUN" || !plan.capability) return null;
  const target = plan.entities?.[0]?.name;
  return target ? `Create ${humanizeKey(plan.capability.key).toLowerCase()} task for ${target}` : `Create ${humanizeKey(plan.capability.key).toLowerCase()} task`;
}
