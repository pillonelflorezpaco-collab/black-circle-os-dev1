import { SocialMediaTabs } from "@/components/blackos/SocialMedia/SocialMediaTabs";
import { SocialMediaFlow } from "@/components/blackos/SocialMedia/SocialMediaFlow";

const CURRENT_STATE: { label: string; done: boolean }[] = [
  { label: "Social Media UI", done: true },
  { label: "Calendar", done: true },
  { label: "Accounts", done: true },
  { label: "Post detail", done: true },
  { label: "Approval actions", done: true },
  { label: "Execution pipeline", done: true },
  { label: "Blotato dry-run", done: true },
  { label: "Real publishing", done: false },
  { label: "Full content library", done: false },
  { label: "Metrics / analytics", done: false },
];

const ARCHITECTURE_RULES = [
  "Agent never executes directly.",
  "Agent never calls n8n directly.",
  "Approval Engine is the human authorization boundary.",
  "Execution Engine is the only execution authority.",
  "Postgres is operational truth.",
  "Neo4j is organizational/context information.",
  "Blotato real publishing is currently disabled.",
  "Agency isolation is mandatory.",
  "Missing permissions = DENIED.",
];

export default function SocialMediaFlowPage() {
  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Social</span> Media
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Dry-run execution only
        </div>
      </div>

      <SocialMediaTabs active="flow" />

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Architecture</span>How the Social Media system works
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--bc-text-faint)", marginTop: -8, marginBottom: 16, maxWidth: 640 }}>
        Click any stage to see what enters it, what it does, what leaves it, which existing BlackOS service is
        responsible, and whether it&apos;s read-only, a proposal, an approval gate, or a real execution authority.
        This reflects the actual current codebase — not a target design.
      </p>

      <div style={{ marginBottom: 24 }}>
        <SocialMediaFlow />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }}>
        <div className="bc-card">
          <div className="bc-section-title" style={{ marginBottom: 10 }}>
            <div className="st-left">
              <span className="eyebrow">Status</span>Current state
            </div>
          </div>
          {CURRENT_STATE.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12.5, color: item.done ? "var(--bc-text)" : "var(--bc-text-faint)" }}>
              <span style={{ color: item.done ? "var(--bc-green)" : "var(--bc-text-faint)", fontFamily: "var(--font-jbmono), monospace" }}>{item.done ? "✓" : "○"}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="bc-card">
          <div className="bc-section-title" style={{ marginBottom: 10 }}>
            <div className="st-left">
              <span className="eyebrow">Rules</span>Architecture rules
            </div>
          </div>
          {ARCHITECTURE_RULES.map((rule) => (
            <div key={rule} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 12.5, color: "var(--bc-text-dim)" }}>
              <span style={{ color: "var(--bc-amber)" }}>•</span>
              {rule}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
