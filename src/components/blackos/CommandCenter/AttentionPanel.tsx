import Link from "next/link";

export interface AttentionCounts {
  pendingApprovals: number;
  blockedTasks: number;
  failedTasks: number;
}

/**
 * Surfaces real items that need a human decision — never fabricated. When
 * there is genuinely nothing to review, shows an honest quiet state rather
 * than manufacturing an alert to fill the space.
 */
export function AttentionPanel({ counts }: { counts: AttentionCounts }) {
  const total = counts.pendingApprovals + counts.blockedTasks + counts.failedTasks;

  return (
    <div className={`bc-card bc-attention${total === 0 ? " quiet" : ""}`}>
      <div className="bc-section-title" style={{ marginBottom: total === 0 ? 0 : 10, border: "none", paddingBottom: 0 }}>
        <div className="st-left">
          <span className="eyebrow">Attention</span>
          {total === 0 ? "Nothing needs a decision" : "Needs your decision"}
        </div>
      </div>

      {total === 0 ? (
        <p className="bc-empty-state">No pending approvals, blocked, or failed tasks.</p>
      ) : (
        <>
          {counts.pendingApprovals > 0 && (
            <Link href="/approvals" className="bc-attention-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="bc-attention-dot" />
              <span>
                <b>{counts.pendingApprovals}</b> approval{counts.pendingApprovals > 1 ? "s" : ""} awaiting decision
              </span>
            </Link>
          )}
          {counts.blockedTasks > 0 && (
            <Link href="/tasks" className="bc-attention-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="bc-attention-dot" />
              <span>
                <b>{counts.blockedTasks}</b> task{counts.blockedTasks > 1 ? "s" : ""} blocked
              </span>
            </Link>
          )}
          {counts.failedTasks > 0 && (
            <Link href="/tasks" className="bc-attention-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="bc-attention-dot crit" />
              <span>
                <b>{counts.failedTasks}</b> task{counts.failedTasks > 1 ? "s" : ""} failed
              </span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
