import type { RiskLevel } from "./types";

export interface ApprovalRequirement {
  approvalRequired: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

// Single centralized policy module — the only place risk→approval logic is
// decided. Not duplicated in the API route, the task service, or anywhere
// else. Deliberately a pure function (RiskLevel in, decision out) so it can
// be unit-tested with synthetic LOW/MEDIUM/HIGH input without needing a real
// HIGH-risk capability to exist in the Neo4j graph (see docs/approval-engine.md §18).
export function evaluateApprovalRequirement(riskLevel: RiskLevel): ApprovalRequirement {
  switch (riskLevel) {
    case "LOW":
      return { approvalRequired: false, riskLevel, reason: "Low-risk capability does not require human approval under the current policy." };
    case "MEDIUM":
      return { approvalRequired: false, riskLevel, reason: "Medium-risk capability does not require approval under the current policy; a future notification-only step is anticipated but not implemented." };
    case "HIGH":
      return { approvalRequired: true, riskLevel, reason: "High-risk capability requires explicit human approval." };
  }
}
