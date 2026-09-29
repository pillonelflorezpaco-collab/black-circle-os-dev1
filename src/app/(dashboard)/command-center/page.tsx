import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getCommandCenterCounts, getRecentTasks, getPendingApprovals, getRecentEvents, getAttentionCounts, getRecentOrchestrations } from "@/services/commandCenter.service";
import { getOrganizationGraph } from "@/services/organization.service";
import { SystemOverview } from "@/components/blackos/CommandCenter/SystemOverview";
import { JarvisPanel } from "@/components/blackos/CommandCenter/JarvisPanel";
import { AttentionPanel } from "@/components/blackos/CommandCenter/AttentionPanel";
import { TaskPanel } from "@/components/blackos/CommandCenter/TaskPanel";
import { ApprovalPanel } from "@/components/blackos/CommandCenter/ApprovalPanel";
import { ActivityPanel } from "@/components/blackos/CommandCenter/ActivityPanel";
import { OrganizationPanel } from "@/components/blackos/CommandCenter/OrganizationPanel";
import { OrchestrationPanel } from "@/components/blackos/CommandCenter/OrchestrationPanel";
import type { OrganizationGraphData } from "@/types/organization";

export default async function CommandCenterPage() {
  const agencyId = await getEffectiveAgencyId();

  const [counts, attention, tasks, approvals, events, orchestrations, orgResult] = await Promise.all([
    getCommandCenterCounts(agencyId),
    getAttentionCounts(agencyId),
    getRecentTasks(agencyId),
    getPendingApprovals(agencyId),
    getRecentEvents(agencyId),
    getRecentOrchestrations(agencyId),
    getOrganizationGraph()
      .then((graph) => ({ graph, error: undefined }) as { graph: OrganizationGraphData; error?: string })
      .catch((err) => ({ graph: null, error: err instanceof Error ? err.message : "Neo4j unavailable." }) as { graph: null; error: string }),
  ]);

  const agentCount = orgResult.graph?.agents.length ?? null;

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Command</span> Center
        </h2>
        <div className="bc-status">
          <span className="dot" />
          JARVIS ONLINE — planning mode only
        </div>
      </div>

      {/* Jarvis is the hero — the central intelligence layer, not one card among several. */}
      <div style={{ marginBottom: 22 }}>
        <JarvisPanel hero />
      </div>

      <div style={{ marginBottom: 22 }}>
        <AttentionPanel counts={attention} />
      </div>

      <SystemOverview
        cards={[
          { label: "Agents", value: agentCount ?? 0, sub: agentCount === null ? "Neo4j unavailable" : "active agents (Neo4j)" },
          { label: "Tasks", value: counts.taskCount, sub: "planned tasks" },
          { label: "Models", value: counts.modelCount, sub: "managed models" },
          { label: "Approvals", value: counts.pendingApprovalCount, sub: "awaiting decision", tone: counts.pendingApprovalCount > 0 ? "amber" : "neutral" },
        ]}
      />

      <div style={{ marginTop: 22, marginBottom: 22 }}>
        <OrganizationPanel graph={orgResult.graph} error={orgResult.error} />
      </div>

      <div className="bc-grid2b">
        <TaskPanel tasks={tasks} />
        <ApprovalPanel approvals={approvals} />
      </div>

      <div style={{ marginTop: 22 }}>
        <OrchestrationPanel orchestrations={orchestrations} />
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Real-time</span>Recent activity
        </div>
      </div>
      <ActivityPanel events={events} />
    </>
  );
}
