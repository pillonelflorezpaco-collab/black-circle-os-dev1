import type { RecentOrchestration } from "@/services/commandCenter.service";

// Display-only labels — OrchestrationState (from Prisma) remains the
// authoritative value; this is presentation, never a second state system.
const STATE_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  PLANNING: "Planning",
  TASK_CREATED: "Task created",
  AWAITING_APPROVAL: "Awaiting approval",
  EXECUTING: "Executing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  NEEDS_CLARIFICATION: "Needs clarification",
  REJECTED: "Rejected",
};

const STATE_TONE: Record<string, string> = {
  AWAITING_APPROVAL: "pending",
  FAILED: "",
  REJECTED: "",
  COMPLETED: "",
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function OrchestrationPanel({ orchestrations, error }: { orchestrations: RecentOrchestration[] | null; error?: string }) {
  return (
    <div className="bc-card">
      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Jarvis Orchestrator</span>Recent orchestrations
        </div>
      </div>

      {error ? (
        <p className="bc-empty-state error">{error}</p>
      ) : orchestrations === null ? (
        <p className="bc-empty-state">Loading…</p>
      ) : orchestrations.length === 0 ? (
        <p className="bc-empty-state">No orchestrations yet.</p>
      ) : (
        orchestrations.map((o) => (
          <div key={o.orchestrationId} className="bc-watch-row">
            <div className="bc-watch-left">
              <div className={`bc-watch-icon ${o.state === "FAILED" || o.state === "REJECTED" ? "dot-crit" : o.state === "AWAITING_APPROVAL" ? "dot-warn" : "dot-ok"}`}>•</div>
              <div>
                <div className="bc-watch-name">{o.requestId ?? o.orchestrationId}</div>
                <div className="bc-watch-sub">
                  {[o.taskId && "task", o.approvalId && "approval", o.executionId && "execution"].filter(Boolean).join(" · ") || "no task yet"} · {timeAgo(o.updatedAt)}
                  {o.failureReason ? ` · ${o.failureReason}` : ""}
                </div>
              </div>
            </div>
            <div className="bc-watch-right">
              <span className={`bc-status-pill ${STATE_TONE[o.state] ?? ""}`}>{STATE_LABEL[o.state] ?? o.state}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
