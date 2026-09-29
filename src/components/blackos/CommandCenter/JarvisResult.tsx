import type { JarvisPlan } from "@/jarvis/types";
import { humanizeKey, statusLabel, reasonLabel, proposedAction } from "./jarvisPresentation";

const RISK_TONE: Record<string, string> = { LOW: "ok", MEDIUM: "warn", HIGH: "crit" };

/**
 * CEO-facing presentation of a Jarvis Core plan — no raw JSON, no field left
 * in machine-case. Every row is either a real field from the plan or absent;
 * nothing is fabricated when data is unavailable (e.g. no "Target" row if
 * no entity was referenced).
 */
export function JarvisResult({ plan }: { plan: JarvisPlan }) {
  const target = plan.entities?.[0]?.name;
  const action = proposedAction(plan);

  return (
    <div className="bc-jarvis-result">
      <div className="bc-jarvis-result-row">
        <span className="k">Status</span>
        <span className={`bc-status-pill${plan.status === "DRY_RUN" ? " pending" : ""}`}>{statusLabel(plan.status)}</span>
      </div>

      {plan.intent && (
        <div className="bc-jarvis-result-row">
          <span className="k">Intent</span>
          <span className="v">{humanizeKey(plan.intent.type)}</span>
        </div>
      )}

      {target && (
        <div className="bc-jarvis-result-row">
          <span className="k">Target</span>
          <span className="v">{target}</span>
        </div>
      )}

      {plan.agent && (
        <div className="bc-jarvis-result-row">
          <span className="k">Agent</span>
          <span className="v">{plan.agent.name}</span>
        </div>
      )}

      {plan.capability && (
        <div className="bc-jarvis-result-row">
          <span className="k">Capability</span>
          <span className="v mono">{plan.capability.key}</span>
        </div>
      )}

      {plan.capability && (
        <div className="bc-jarvis-result-row">
          <span className="k">Risk</span>
          <span className={`bc-cc-status ${RISK_TONE[plan.capability.riskLevel] ?? ""}`}>{plan.capability.riskLevel}</span>
        </div>
      )}

      {action && (
        <div className="bc-jarvis-result-row">
          <span className="k">Proposed Action</span>
          <span className="v">{action}</span>
        </div>
      )}

      {plan.reason && (
        <div className="bc-jarvis-result-row">
          <span className="k">{plan.status === "DRY_RUN" ? "Note" : "Clarification needed"}</span>
          <span className="v dim">{reasonLabel(plan.reason)}</span>
        </div>
      )}

      <div className="bc-jarvis-result-row">
        <span className="k">Execution</span>
        <span className="v dim">Not executed — planning only</span>
      </div>
    </div>
  );
}
