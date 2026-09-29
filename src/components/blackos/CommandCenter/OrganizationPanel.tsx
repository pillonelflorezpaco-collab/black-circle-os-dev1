import Link from "next/link";
import type { OrganizationGraphData } from "@/types/organization";

// Same positional palette EcosystemGraph.tsx uses, so the dots here visually
// match the real graph a click-through leads to.
const DEPARTMENT_COLORS = ["var(--bc-amber)", "var(--bc-red)", "var(--bc-gold)", "var(--bc-rose)", "var(--bc-blue)", "var(--bc-green)", "var(--bc-violet)", "var(--bc-teal)", "var(--bc-slate)"];

/**
 * Compact summary card — intentionally not a second graph. The full
 * interactive constellation lives at /ecosysteme; this card exists to
 * orient the CEO at a glance and link through, per Command Center V0.2 §5.
 */
export function OrganizationPanel({ graph, error }: { graph: OrganizationGraphData | null; error?: string }) {
  return (
    <div className="bc-card">
      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Neo4j</span>Organization
        </div>
        <Link href="/ecosysteme" style={{ fontSize: 11.5, color: "var(--bc-amber)" }}>
          View full ecosystem →
        </Link>
      </div>

      {error ? (
        <p className="bc-empty-state error">Organization graph unavailable: {error}</p>
      ) : graph === null ? (
        <p className="bc-empty-state">Loading…</p>
      ) : (
        <>
          <div className="bc-eco-stats" style={{ paddingTop: 0, paddingBottom: 14 }}>
            <div className="bc-eco-stat">
              <div className="n">{graph.departments.length}</div>
              <div className="lab">Departments</div>
            </div>
            <div className="bc-eco-stat">
              <div className="n">{graph.agents.length}</div>
              <div className="lab">Agents</div>
            </div>
            <div className="bc-eco-stat">
              <div className="n">{graph.capabilities.length}</div>
              <div className="lab">Capabilities</div>
            </div>
            <div className="bc-eco-stat">
              <div className="n">{graph.tools.length}</div>
              <div className="lab">Tools</div>
            </div>
          </div>

          <div className="bc-org-preview-dots">
            {graph.departments.map((dept, i) => (
              <div
                key={dept.key}
                className="bc-org-preview-dot"
                style={{ background: DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length], opacity: dept.agentCount > 0 ? 1 : 0.3 }}
                title={`${dept.name} — ${dept.agentCount} agent${dept.agentCount === 1 ? "" : "s"}`}
              />
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--bc-text-faint)" }}>
            {graph.departments.filter((d) => d.agentCount > 0).length} of {graph.departments.length} departments have an active agent.
          </p>
        </>
      )}
    </div>
  );
}
