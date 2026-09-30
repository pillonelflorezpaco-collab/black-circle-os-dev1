"use client";

import { useState } from "react";

type StageKind = "read-only" | "proposes" | "requires-approval" | "executes";
type StageStatus = "IMPLEMENTED" | "NEXT" | "DISABLED";

interface FlowStage {
  key: string;
  title: string;
  subtitle: string;
  status: StageStatus;
  kind: StageKind;
  input: string;
  process: string;
  output: string;
  authority: string;
  next: string;
  note?: string;
}

const STAGES: FlowStage[] = [
  {
    key: "content",
    title: "CONTENT / DRIVE",
    subtitle: "Video · Caption · Drive reference",
    status: "IMPLEMENTED",
    kind: "read-only",
    input: "A Model, plus a video/image file already uploaded off-app (Google Drive today).",
    process: "The Video row stores driveFileId/driveUrl/thumbnailUrl/caption, linked to its Model. There is no in-app upload or Drive browser — this is a reference only.",
    output: "A Video record other stages (Post, Blotato Preview) can point to.",
    authority: "Video model (content pipeline) — no dedicated \"Content Engine\" exists.",
    next: "A Post is created referencing this Video and a target SocialAccount.",
    note: "Drive is only a URL/ID reference on Video today, not a full content library or browser. Do not read this as a real Drive integration.",
  },
  {
    key: "post",
    title: "POST",
    subtitle: "Model · Social account · Platform · Media · Caption · Scheduled time",
    status: "IMPLEMENTED",
    kind: "read-only",
    input: "Video + SocialAccount + a scheduledTime.",
    process: "post.service.ts / the Post repository read and display these rows; the Post's own status field (PENDING/SCHEDULED/IN_PROGRESS/PUBLISHED/FAILED) is a separate, older lifecycle that the Task/Approval/Execution chain below does not write back to.",
    output: "A Post visible in the Social Media Command Center — Overview, Calendar and detail panel.",
    authority: "post.service.ts / socialMedia.service.ts",
    next: "The Calendar and Post detail show it; Jarvis, given metadata.postId, can create a Task referencing it.",
  },
  {
    key: "calendar",
    title: "CALENDAR",
    subtitle: "Date · Time · Platform · Account · Status",
    status: "IMPLEMENTED",
    kind: "read-only",
    input: "All Posts whose scheduledTime falls in the viewed month.",
    process: "getSocialMediaCalendar() runs one bounded month-range query — never the whole table — and derives each post's real lifecycle state.",
    output: "A clickable month grid; selecting a post opens its full detail panel.",
    authority: "socialMedia.service.ts (/social-media/calendar)",
    next: "Opens the same Post detail used everywhere else — no separate calendar persistence.",
  },
  {
    key: "approval-engine",
    title: "APPROVAL ENGINE",
    subtitle: "Risk level · Capability · PENDING / APPROVED / REJECTED",
    status: "IMPLEMENTED",
    kind: "proposes",
    input: "The persisted Task's riskLevel and capabilityKey — never a caller-supplied value.",
    process: "evaluateApprovalRequirement() decides if approval is required. social_media_management is explicitly listed to always require approval, regardless of its resolved risk level.",
    output: "An Approval row: PENDING (if required), or none at all (if not).",
    authority: "approvalPolicy.ts + approvalService.ts — the single centralized policy module.",
    next: "A PENDING approval blocks execution until a human decides.",
  },
  {
    key: "human-gate",
    title: "HUMAN APPROVAL GATE",
    subtitle: "The authorization boundary",
    status: "IMPLEMENTED",
    kind: "requires-approval",
    input: "A PENDING Approval, plus a session belonging to a user with the approuverTaches permission.",
    process: "A human clicks Approve or Reject (ApprovalActions.tsx) → POST /api/approvals/[id]/approve|reject → approveApproval()/rejectApproval(), which re-checks the permission and agency server-side regardless of what the UI shows.",
    output: "Approval.status becomes APPROVED (Task → READY) or REJECTED (Task → CANCELLED).",
    authority: "The human approver. This is the sole point in the entire system where a real side effect is authorized.",
    next: "Execution Engine may now proceed, but only re-checks — it never trusts this decision blindly either.",
  },
  {
    key: "task",
    title: "TASK",
    subtitle: "PLANNED · READY · WAITING_APPROVAL · IN_PROGRESS · COMPLETED · FAILED · CANCELLED",
    status: "IMPLEMENTED",
    kind: "read-only",
    input: "A plan resolved by Jarvis Core (intent, agent, capability, risk, entity).",
    process: "The Task Engine persists the plan verbatim — it does not re-decide anything Jarvis already resolved.",
    output: "A Task row that Approval and Execution both reference by id.",
    authority: "Task Engine (taskService.ts / task.repository.ts).",
    next: "Once READY (and approved, if required), Execution Engine can dispatch it.",
  },
  {
    key: "execution",
    title: "EXECUTION",
    subtitle: "PENDING · RUNNING · AWAITING_CALLBACK · SUCCEEDED · FAILED",
    status: "IMPLEMENTED",
    kind: "executes",
    input: "A Task with status READY — and, for social_media_management, a real APPROVED Approval re-verified at this exact moment, not trusted from Task.status alone.",
    process: "createExecutionForTask() re-derives everything from the Task row (tool, workflow, postId) and dispatches — it never trusts a caller-supplied value.",
    output: "An Execution row with a terminal status and a sanitized result payload.",
    authority: "Execution Engine (executionService.ts) — the only module allowed to cause a real side effect.",
    next: "For social_media_management, dispatch goes to the Blotato adapter.",
  },
  {
    key: "blotato",
    title: "BLOTATO",
    subtitle: "Account · Platform · Media · Caption · Scheduled time",
    status: "IMPLEMENTED",
    kind: "executes",
    input: "The Post's resolved SocialAccount → BlotatoAccount chain, validated for agency ownership at every hop.",
    process: "dryRunPublish() builds the exact outbound request Blotato would receive — the API key is never read or decrypted on this path.",
    output: "The built request, stored in Execution.result for audit — never actually sent.",
    authority: "blotatoAdapter.ts — the only module allowed to call BlotatoClient.",
    next: "Nothing further — this is the last real stage until real publishing is a separate, explicit decision.",
    note: "publishReal() exists and is unit-tested in isolation, but has no caller anywhere in executionService.ts today.",
  },
  {
    key: "dry-run",
    title: "CURRENT SAFETY STATE",
    subtitle: "DRY RUN — REAL PUBLISHING DISABLED",
    status: "DISABLED",
    kind: "read-only",
    input: "—",
    process: "executionService.ts imports and calls dryRunPublish() only. A dedicated static guard test asserts it does not import publishReal.",
    output: "No post is ever actually published to a real platform by this system today.",
    authority: "This is a deliberate architectural boundary, not a missing feature.",
    next: "Enabling real publishing is a separate, explicit decision for a future implementation step.",
  },
];

const STATUS_PILL: Record<StageStatus, { label: string; className: string }> = {
  IMPLEMENTED: { label: "Currently implemented", className: "ok" },
  NEXT: { label: "Next implementation step", className: "pending" },
  DISABLED: { label: "Future / disabled", className: "crit" },
};

const KIND_LABEL: Record<StageKind, string> = {
  "read-only": "Read-only",
  proposes: "Proposes an action",
  "requires-approval": "Requires human approval",
  executes: "Executes (real side effect authority)",
};

export function SocialMediaFlow() {
  const [selectedKey, setSelectedKey] = useState<string>(STAGES[3].key);
  const selected = STAGES.find((s) => s.key === selectedKey) ?? STAGES[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 20 }}>
      <div className="bc-card">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
          {STAGES.map((stage, i) => (
            <div key={stage.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setSelectedKey(stage.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  background: selectedKey === stage.key ? "var(--bc-amber-glow)" : "var(--bc-surface-2)",
                  border: `1px solid ${selectedKey === stage.key ? "var(--bc-amber)" : "var(--bc-border)"}`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-jbmono), monospace", fontSize: 12.5, letterSpacing: 0.3, color: selectedKey === stage.key ? "var(--bc-amber)" : "var(--bc-text)" }}>{stage.title}</div>
                  <div style={{ fontSize: 11, color: "var(--bc-text-faint)", marginTop: 3 }}>{stage.subtitle}</div>
                </div>
                <span className={`bc-status-pill ${STATUS_PILL[stage.status].className}`} style={{ flexShrink: 0 }}>
                  {STATUS_PILL[stage.status].label}
                </span>
              </button>
              {i < STAGES.length - 1 && (
                <div style={{ fontFamily: "var(--font-jbmono), monospace", color: "var(--bc-text-faint)", fontSize: 14, padding: "4px 0" }}>↓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bc-card" style={{ alignSelf: "flex-start", position: "sticky", top: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="bc-jarvis-eyebrow" style={{ marginBottom: 4 }}>
              {KIND_LABEL[selected.kind]}
            </div>
            <div style={{ fontSize: 16, color: "var(--bc-text)" }}>{selected.title}</div>
          </div>
          <span className={`bc-status-pill ${STATUS_PILL[selected.status].className}`}>{STATUS_PILL[selected.status].label}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Input</div>
            <div style={{ color: "var(--bc-text-dim)" }}>{selected.input}</div>
          </div>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Process</div>
            <div style={{ color: "var(--bc-text-dim)" }}>{selected.process}</div>
          </div>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Output</div>
            <div style={{ color: "var(--bc-text-dim)" }}>{selected.output}</div>
          </div>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Authority</div>
            <div style={{ color: "var(--bc-text-dim)" }}>{selected.authority}</div>
          </div>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Next</div>
            <div style={{ color: "var(--bc-text-dim)" }}>{selected.next}</div>
          </div>
          {selected.note && (
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--bc-border)", color: "var(--bc-amber)", fontSize: 11.5 }}>{selected.note}</div>
          )}
        </div>
      </div>
    </div>
  );
}
