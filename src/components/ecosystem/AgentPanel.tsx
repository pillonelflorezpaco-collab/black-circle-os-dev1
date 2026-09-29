"use client";

import type { OrganizationAgent, OrganizationCapability, OrganizationDepartment, OrganizationTool } from "@/types/organization";

const RISK_TONE: Record<string, string> = { LOW: "ok", MEDIUM: "warn", HIGH: "crit" };

/**
 * Real-data equivalent of PersonPanel.tsx, adapted for a Neo4j Agent —
 * read-only (no access-toggle affordance, since fine-grained HAS_ACCESS
 * permissions are not seeded yet — see /opt/neo4j/README.md §9). Reuses the
 * exact same .bc-eco-panel-* CSS classes as PersonPanel for visual continuity.
 */
export function AgentPanel({
  agent,
  department,
  capabilities,
  tools,
  onClose,
}: {
  agent: OrganizationAgent;
  department: OrganizationDepartment | null;
  capabilities: OrganizationCapability[];
  tools: OrganizationTool[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="bc-eco-panel-backdrop" onClick={onClose} />
      <div className="bc-eco-panel">
        <button type="button" className="bc-eco-panel-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <div className="bc-eco-panel-avatar">{agent.name.charAt(0)}</div>
        <div className="bc-eco-panel-name">{agent.name}</div>
        <div className="bc-eco-panel-role">
          {agent.type} · {department?.name ?? "—"}
        </div>

        <div className="bc-eco-panel-meta">
          <div>
            <div className="n">{capabilities.length}</div>
            <div className="lab">Capacités</div>
          </div>
          <div>
            <div className="n">{tools.length}</div>
            <div className="lab">Outils liés</div>
          </div>
          <div>
            <div className="n">{agent.status}</div>
            <div className="lab">Statut</div>
          </div>
        </div>

        <div className="bc-nav-label" style={{ padding: 0, margin: "0 0 8px" }}>
          Capacités (Neo4j)
        </div>
        {capabilities.length === 0 && <p style={{ color: "var(--bc-text-faint)", fontSize: 12, fontStyle: "italic" }}>Aucune capacité assignée.</p>}
        {capabilities.map((cap) => (
          <div key={cap.key} className="bc-eco-tool-row">
            <span className={`bc-cc-status ${RISK_TONE[cap.riskLevel] ?? ""}`}>{cap.riskLevel}</span>
            <span style={{ fontSize: 13, color: "var(--bc-text)" }}>{cap.name}</span>
          </div>
        ))}

        <div className="bc-nav-label" style={{ padding: 0, margin: "18px 0 8px" }}>
          Outils
        </div>
        {tools.length === 0 && <p style={{ color: "var(--bc-text-faint)", fontSize: 12, fontStyle: "italic" }}>Aucun outil rattaché.</p>}
        {tools.map((tool) => (
          <div key={tool.key} className="bc-eco-tool-row">
            <div className="bc-eco-tool-icon">{tool.name.slice(0, 2).toUpperCase()}</div>
            <span style={{ fontSize: 13, color: "var(--bc-text)" }}>{tool.name}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--bc-text-faint)", fontFamily: "var(--font-jbmono)" }}>{tool.type}</span>
          </div>
        ))}
      </div>
    </>
  );
}
