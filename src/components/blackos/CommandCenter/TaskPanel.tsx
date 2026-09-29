import type { Task } from "@prisma/client";

type TaskWithEntity = Task & { entityName?: string };

const RISK_TONE: Record<string, string> = { LOW: "dot-ok", MEDIUM: "dot-warn", HIGH: "dot-crit" };
const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };

export function TaskPanel({ tasks, error }: { tasks: TaskWithEntity[] | null; error?: string }) {
  return (
    <div className="bc-card">
      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Task Engine</span>Recent tasks
        </div>
      </div>

      {error ? (
        <p className="bc-empty-state error">{error}</p>
      ) : tasks === null ? (
        <p className="bc-empty-state">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="bc-empty-state">No tasks planned yet.</p>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="bc-watch-row">
            <div className="bc-watch-left">
              <div className={`bc-watch-icon ${RISK_TONE[task.riskLevel ?? ""] ?? ""}`}>•</div>
              <div>
                <div className="bc-watch-name">
                  {task.entityName ?? "Untitled target"} <span style={{ color: "var(--bc-text-faint)", fontWeight: 400 }}>— {task.title}</span>
                </div>
                <div className="bc-watch-sub">
                  {task.agentKey ?? "—"} · {task.capabilityKey ?? "—"}
                  {task.priority !== "NORMAL" && ` · ${PRIORITY_LABEL[task.priority]} priority`}
                </div>
              </div>
            </div>
            <div className="bc-watch-right">
              <span className="bc-status-pill">{task.status}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
