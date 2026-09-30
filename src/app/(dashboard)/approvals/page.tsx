import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getPendingApprovals } from "@/services/commandCenter.service";
import { ApprovalPanel } from "@/components/blackos/CommandCenter/ApprovalPanel";

export default async function ApprovalsPage() {
  const session = await auth();
  const canDecide = !!session?.user && can(session.user.role, "approuverTaches");
  const agencyId = await getEffectiveAgencyId();
  const approvals = await getPendingApprovals(agencyId, 50);

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Approvals</span>
        </h2>
        <div className="bc-status">
          <span className="dot" />
          {canDecide ? "Approval Engine v0.1" : "Approval Engine v0.1 — read only"}
        </div>
      </div>

      <div className="bc-page-summary">
        <span className="bc-page-summary-stat">
          <b>{approvals.length}</b> pending
        </span>
      </div>

      <ApprovalPanel approvals={approvals} canDecide={canDecide} />
    </>
  );
}
