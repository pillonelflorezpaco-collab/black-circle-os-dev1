import type { RiskLevel } from "./types";

export interface ApprovalRequirement {
  approvalRequired: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

// Capability-specific override, evaluated BEFORE the generic risk-level
// switch below — see docs/social-media-execution.md "Human decision still
// required" and the External Side-Effect Approval Audit that authorized
// this. This is deliberately a narrow, explicit exception list, not a
// generic per-capability policy framework: it exists because
// social_media_management can cause a real external side effect
// (publishing publicly) that the generic MEDIUM-risk policy was never
// designed with in mind — it does NOT change what MEDIUM means for any
// other capability, current or future. Extend this set only when a
// concrete capability has the same property (a real external side effect
// whose risk isn't already fully captured by its resolved riskLevel).
const CAPABILITIES_REQUIRING_APPROVAL_REGARDLESS_OF_RISK = new Set(["social_media_management"]);

// Single centralized policy module — the only place risk→approval logic is
// decided. Not duplicated in the API route, the task service, the
// execution gate, or anywhere else. `capabilityKey` is optional so this
// remains callable exactly as before (RiskLevel-only) for any caller that
// doesn't have one — see docs/approval-engine.md §18 for why the function
// stays a pure, synthetically-testable input→output mapping rather than a
// database lookup.
export function evaluateApprovalRequirement(riskLevel: RiskLevel, capabilityKey?: string): ApprovalRequirement {
  if (capabilityKey && CAPABILITIES_REQUIRING_APPROVAL_REGARDLESS_OF_RISK.has(capabilityKey)) {
    return {
      approvalRequired: true,
      riskLevel,
      reason: `Capability "${capabilityKey}" always requires human approval regardless of its resolved risk level, because it can cause a real external side effect (publishing content publicly).`,
    };
  }

  switch (riskLevel) {
    case "LOW":
      return { approvalRequired: false, riskLevel, reason: "Low-risk capability does not require human approval under the current policy." };
    case "MEDIUM":
      return { approvalRequired: false, riskLevel, reason: "Medium-risk capability does not require approval under the current policy; a future notification-only step is anticipated but not implemented." };
    case "HIGH":
      return { approvalRequired: true, riskLevel, reason: "High-risk capability requires explicit human approval." };
  }
}

/** Reused by executionService.ts's approval gate — see that file's comment — so the capability list is never duplicated outside this module. */
export function capabilityAlwaysRequiresApproval(capabilityKey: string | null | undefined): boolean {
  return !!capabilityKey && CAPABILITIES_REQUIRING_APPROVAL_REGARDLESS_OF_RISK.has(capabilityKey);
}
