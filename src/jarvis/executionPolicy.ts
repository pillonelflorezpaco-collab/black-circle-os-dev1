import type { JarvisDecision, RiskLevel } from "./types";

// Phase boundary: Jarvis Core is READ/PLAN ONLY. This is the single place
// that decides executionAllowed, so it can never accidentally be set true
// elsewhere in the pipeline. Approvals are not implemented yet (see task
// §13) — approvalRequired is reported as false here regardless of risk
// level; the risk level itself is still returned in the plan so a future
// approvals phase has the data it needs without re-touching this module.
export function decideForRisk(_riskLevel: RiskLevel): JarvisDecision {
  return {
    action: "DELEGATE",
    executionAllowed: false,
    approvalRequired: false,
  };
}
