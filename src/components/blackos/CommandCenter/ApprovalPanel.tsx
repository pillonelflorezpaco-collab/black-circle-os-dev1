import type { Approval, Task } from "@prisma/client";
import { ApprovalActions } from "./ApprovalActions";

type ApprovalWithTask = Approval & { task: Pick<Task, "id" | "title"> };

function timeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function ApprovalPanel({ approvals, error, canDecide = false }: { approvals: ApprovalWithTask[] | null; error?: string; canDecide?: boolean }) {
  return (
    <div className="bc-card">
      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Approval Engine</span>Approbations en attente
        </div>
      </div>

      {error ? (
        <p className="bc-empty-state error">{error}</p>
      ) : approvals === null ? (
        <p className="bc-empty-state">Chargement…</p>
      ) : approvals.length === 0 ? (
        <p className="bc-empty-state">Aucune approbation en attente.</p>
      ) : (
        approvals.map((approval) => (
          <div key={approval.id} className="bc-watch-row">
            <div className="bc-watch-left">
              <div className="bc-watch-icon dot-crit">•</div>
              <div>
                <div className="bc-watch-name">{approval.task.title}</div>
                <div className="bc-watch-sub">
                  Risque {approval.riskLevel} · {timeAgo(approval.createdAt)}
                </div>
              </div>
            </div>
            <div className="bc-watch-right">
              {canDecide ? <ApprovalActions approvalId={approval.id} /> : <span className="bc-status-pill pending">EN ATTENTE</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
