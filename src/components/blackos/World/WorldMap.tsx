"use client";

import { useState } from "react";
import Link from "next/link";
import type { BlackosWorldSnapshot } from "@/services/blackosWorld.service";

const EXECUTION_TAKE_LABEL = 15;

type Selected =
  | { kind: "jarvis" }
  | { kind: "department"; key: string }
  | { kind: "software-agent"; key: string }
  | { kind: "task"; id: string }
  | { kind: "approval" }
  | { kind: "execution"; id: string }
  | { kind: "tool"; key: string }
  | null;

const TASK_STATUS_CLASS: Record<string, string> = {
  PLANNED: "",
  READY: "ok",
  WAITING_APPROVAL: "pending",
  IN_PROGRESS: "pending",
  COMPLETED: "ok",
  FAILED: "crit",
  CANCELLED: "crit",
  BLOCKED: "crit",
};

const EXECUTION_STATUS_CLASS: Record<string, string> = {
  PENDING: "pending",
  RUNNING: "pending",
  AWAITING_CALLBACK: "pending",
  SUCCEEDED: "ok",
  FAILED: "crit",
  TIMED_OUT: "crit",
  CANCELLED: "crit",
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ color: "var(--bc-text-dim)", fontSize: 12.5 }}>{children}</div>
    </div>
  );
}

export function WorldMap({ snapshot }: { snapshot: BlackosWorldSnapshot }) {
  const [selected, setSelected] = useState<Selected>({ kind: "jarvis" });

  const dept = selected?.kind === "department" ? snapshot.departments.find((d) => d.key === selected.key) : null;
  const softwareAgent = selected?.kind === "software-agent" ? snapshot.softwareAgents.find((a) => a.key === selected.key) : null;
  const task = selected?.kind === "task" ? snapshot.tasks.find((t) => t.id === selected.id) : null;
  const execution = selected?.kind === "execution" ? snapshot.executions.find((e) => e.id === selected.id) : null;
  const tool = selected?.kind === "tool" ? snapshot.tools.find((t) => t.key === selected.key) : null;
  const taskDeptName = task?.departmentKey ? snapshot.departments.find((d) => d.key === task.departmentKey)?.name : null;
  const taskToolName = task?.execution?.toolKey ? snapshot.tools.find((t) => t.key === task.execution!.toolKey)?.name : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* DETAIL PANEL — always visible, updates on selection */}
      <div className="bc-card" style={{ borderColor: "var(--bc-amber-dim)" }}>
        {selected?.kind === "jarvis" && (
          <>
            <div className="bc-jarvis-eyebrow">JARVIS — CIO / Orchestrator</div>
            <span className="bc-status-pill" style={{ marginBottom: 10, display: "inline-block" }}>
              STATUS: NOT CURRENTLY EXPOSED
            </span>
            <Field label="What is this?">
              Jarvis Core (src/jarvis/core.ts) is a stateless, deterministic keyword-based intent resolver — it turns a message into an
              intent, agent, capability and risk level. The Orchestrator (src/orchestrator/orchestratorService.ts) sequences Jarvis Core →
              Task Engine → Approval Engine → Execution Engine for one request at a time.
            </Field>
            <Field label="Current state">
              There is no persistent &quot;Jarvis is thinking&quot; flag — each request is resolved synchronously and returns. The closest real
              signal is an individual request&apos;s OrchestrationRecord.state (REQUESTED / PLANNING / TASK_CREATED / AWAITING_APPROVAL /
              EXECUTING / COMPLETED / FAILED) — see recent Tasks below for actual in-flight examples, not a global Jarvis status.
            </Field>
            <Field label="Allowed">Resolve intent/entity/capability/risk. Persist a Task proposal via the Task Engine.</Field>
            <Field label="Not allowed">Approve anything. Execute anything. Call n8n or Blotato directly. Decide authoritatively on its own.</Field>
            <Field label="Connects to">Agents (proposes plans on their behalf) → Task Engine → Approval Engine → Execution Engine.</Field>
          </>
        )}

        {dept && (
          <>
            <div className="bc-jarvis-eyebrow">DEPARTMENT (Neo4j)</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>{dept.name}</div>
            <Field label="Key">{dept.key}</Field>
            <Field label="Status">{dept.status}</Field>
            <Field label="Organizational agents (Neo4j)">{dept.graphAgentKeys.length > 0 ? dept.graphAgentKeys.join(", ") : "None"}</Field>
            <Field label="Capabilities">
              {dept.capabilities.length > 0 ? dept.capabilities.map((c) => `${c.name} (${c.riskLevel})`).join(", ") : "None resolved"}
            </Field>
            <Field label="Recent tasks (last 15 system-wide)">{dept.recentTaskCount}</Field>
          </>
        )}

        {softwareAgent && (
          <>
            <div className="bc-jarvis-eyebrow">SOFTWARE AGENT (code registry)</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>{softwareAgent.name}</div>
            <span className="bc-status-pill" style={{ marginBottom: 10, display: "inline-block" }}>
              STATUS: NOT CURRENTLY EXPOSED
            </span>
            <Field label="Description">{softwareAgent.description}</Field>
            <Field label="Decisions it can return">{softwareAgent.decisionTypes.join(" / ")}</Field>
            <Field label="Last known activity">Not currently exposed — invocations are synchronous and not logged as a persisted activity trail.</Field>
            <Field label="What it can not do">Execute, approve, or persist a Task itself — PROPOSE_TASK only ever returns a plan for a caller to act on.</Field>
            <Field label="Note">
              This is a code-defined Agent (src/agents/agentService.ts) — distinct from the Neo4j organizational Agent nodes shown under
              Departments above. Nothing currently links a Task back to which software Agent (if any) proposed it.
            </Field>
          </>
        )}

        {task && (
          <>
            <div className="bc-jarvis-eyebrow">TASK</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>{task.title}</div>
            <Field label="Status">
              <span className={`bc-status-pill ${TASK_STATUS_CLASS[task.status] ?? ""}`}>{task.status}</span>
            </Field>
            <Field label="Chain">
              {taskDeptName ?? task.departmentKey ?? "—"} → {task.agentKey ?? "—"} (Neo4j) → Task → {task.approval ? task.approval.status : "no Approval"} →{" "}
              {task.execution ? task.execution.status : "no Execution"} → {taskToolName ?? task.execution?.toolKey ?? "—"}
            </Field>
            <Field label="Capability / Risk">
              {task.capabilityKey ?? "—"} / {task.riskLevel ?? "—"}
            </Field>
            <Field label="Created">{timeAgo(task.createdAt)}</Field>
          </>
        )}

        {selected?.kind === "approval" && (
          <>
            <div className="bc-jarvis-eyebrow">APPROVAL GATE — HUMAN AUTHORIZATION BOUNDARY</div>
            <Field label="What is this?">
              Agent proposes → Approval created → Human decision (Approve/Reject) → Execution may proceed only after APPROVED. This is the
              one point in the entire system where a real side effect is authorized.
            </Field>
            <Field label="Current counts">
              {snapshot.approvals.pending} pending · {snapshot.approvals.approvedRecent} approved (24h) · {snapshot.approvals.rejectedRecent} rejected (24h)
            </Field>
            <Field label="Authority">The human approver — approvalService.ts re-checks permission and agency server-side on every decision.</Field>
            <Link href="/approvals" style={{ color: "var(--bc-amber)", fontSize: 12 }}>
              Open the Approvals workspace →
            </Link>
          </>
        )}

        {execution && (
          <>
            <div className="bc-jarvis-eyebrow">EXECUTION</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>{execution.taskTitle}</div>
            <Field label="Status">
              <span className={`bc-status-pill ${EXECUTION_STATUS_CLASS[execution.status] ?? ""}`}>{execution.status}</span>
            </Field>
            <Field label="Tool / Workflow">
              {execution.toolKey} / {execution.workflowRef}
            </Field>
            <Field label="Timestamps">
              Started {execution.startedAt ? timeAgo(execution.startedAt) : "—"} · Finished {execution.finishedAt ? timeAgo(execution.finishedAt) : "—"}
            </Field>
            {execution.resultSummary && <Field label="Result summary">{execution.resultSummary}</Field>}
            {execution.failureReason && (
              <Field label="Failure reason">
                <span style={{ color: "var(--bc-red)" }}>{execution.failureReason}</span>
              </Field>
            )}
          </>
        )}

        {tool && (
          <>
            <div className="bc-jarvis-eyebrow">TOOL</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>{tool.name}</div>
            <Field label="Type">{tool.type}</Field>
            <Field label="Available">Yes — defined in the Neo4j organizational graph.</Field>
            <Field label="Currently used">{tool.currentlyUsedCount} of the last {EXECUTION_TAKE_LABEL} executions</Field>
            {tool.note && (
              <Field label="Note">
                <span style={{ color: "var(--bc-amber)" }}>{tool.note}</span>
              </Field>
            )}
          </>
        )}
      </div>

      {/* JARVIS + DEPARTMENTS */}
      <div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setSelected({ kind: "jarvis" })}
            className="bc-card"
            style={{
              cursor: "pointer",
              textAlign: "center",
              padding: "16px 40px",
              border: `1px solid ${selected?.kind === "jarvis" ? "var(--bc-amber)" : "var(--bc-border)"}`,
              background: selected?.kind === "jarvis" ? "var(--bc-amber-glow)" : "var(--bc-surface)",
            }}
          >
            <div style={{ fontFamily: "var(--font-jbmono), monospace", fontSize: 13, letterSpacing: 1, color: "var(--bc-amber)" }}>JARVIS</div>
            <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>CIO / Orchestrator</div>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {snapshot.departments.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelected({ kind: "department", key: d.key })}
              className="bc-card"
              style={{
                cursor: "pointer",
                textAlign: "left",
                padding: "12px 14px",
                border: `1px solid ${selected?.kind === "department" && selected.key === d.key ? "var(--bc-amber)" : "var(--bc-border)"}`,
                background: selected?.kind === "department" && selected.key === d.key ? "var(--bc-amber-glow)" : "var(--bc-surface-2)",
              }}
            >
              <div style={{ fontSize: 12.5, color: "var(--bc-text)" }}>{d.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)", marginTop: 3 }}>
                {d.graphAgentCount} agent{d.graphAgentCount === 1 ? "" : "s"} · {d.recentTaskCount} recent task{d.recentTaskCount === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SOFTWARE AGENTS */}
      <div className="bc-card">
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Code registry</span>Software Agents
          </div>
        </div>
        {snapshot.softwareAgents.length === 0 ? (
          <p className="bc-empty-state">No Agents registered.</p>
        ) : (
          snapshot.softwareAgents.map((agent) => (
            <div
              key={agent.key}
              className="bc-watch-row"
              style={{ cursor: "pointer" }}
              onClick={() => setSelected({ kind: "software-agent", key: agent.key })}
            >
              <div className="bc-watch-left">
                <div className="bc-watch-icon">•</div>
                <div>
                  <div className="bc-watch-name">{agent.name}</div>
                  <div className="bc-watch-sub">{agent.description}</div>
                </div>
              </div>
              <span className="bc-status-pill">{agent.enabled ? "ENABLED" : "DISABLED"}</span>
            </div>
          ))
        )}
      </div>

      {/* TASK STREAM */}
      <div className="bc-card">
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Live</span>Task stream
          </div>
        </div>
        {snapshot.tasks.length === 0 ? (
          <p className="bc-empty-state">No active tasks</p>
        ) : (
          snapshot.tasks.map((t) => (
            <div key={t.id} className="bc-watch-row" style={{ cursor: "pointer" }} onClick={() => setSelected({ kind: "task", id: t.id })}>
              <div className="bc-watch-left">
                <div className="bc-watch-icon">•</div>
                <div>
                  <div className="bc-watch-name">{t.title}</div>
                  <div className="bc-watch-sub">
                    {t.departmentKey ?? "—"} · {t.agentKey ?? "—"} · {timeAgo(t.createdAt)}
                  </div>
                </div>
              </div>
              <span className={`bc-status-pill ${TASK_STATUS_CLASS[t.status] ?? ""}`}>{t.status}</span>
            </div>
          ))
        )}
      </div>

      {/* APPROVAL GATE */}
      <button
        type="button"
        onClick={() => setSelected({ kind: "approval" })}
        className="bc-card"
        style={{ cursor: "pointer", textAlign: "left", border: `1px solid ${selected?.kind === "approval" ? "var(--bc-amber)" : "var(--bc-border)"}` }}
      >
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Human gate</span>Approval Engine
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12.5 }}>
          <span>
            <b style={{ color: "var(--bc-amber)" }}>{snapshot.approvals.pending}</b> pending
          </span>
          <span>
            <b style={{ color: "var(--bc-green)" }}>{snapshot.approvals.approvedRecent}</b> approved (24h)
          </span>
          <span>
            <b style={{ color: "var(--bc-red)" }}>{snapshot.approvals.rejectedRecent}</b> rejected (24h)
          </span>
        </div>
      </button>

      {/* EXECUTIONS */}
      <div className="bc-card">
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Execution Engine</span>Recent executions
          </div>
        </div>
        {snapshot.executions.length === 0 ? (
          <p className="bc-empty-state">No executions yet.</p>
        ) : (
          snapshot.executions.map((e) => (
            <div key={e.id} className="bc-watch-row" style={{ cursor: "pointer" }} onClick={() => setSelected({ kind: "execution", id: e.id })}>
              <div className="bc-watch-left">
                <div className="bc-watch-icon">•</div>
                <div>
                  <div className="bc-watch-name">{e.taskTitle}</div>
                  <div className="bc-watch-sub">{e.toolKey}</div>
                </div>
              </div>
              <span className={`bc-status-pill ${EXECUTION_STATUS_CLASS[e.status] ?? ""}`}>{e.status}</span>
            </div>
          ))
        )}
      </div>

      {/* TOOLS */}
      <div className="bc-card">
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Tool layer</span>Tools
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {snapshot.tools.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected({ kind: "tool", key: t.key })}
              className="bc-plat-chip"
              style={{ cursor: "pointer", background: selected?.kind === "tool" && selected.key === t.key ? "var(--bc-amber-glow)" : undefined }}
            >
              {t.name}
              {t.note && <span style={{ color: "var(--bc-amber)", marginLeft: 6 }}>DRY RUN</span>}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE ACTIVITY */}
      <div className="bc-card">
        <div className="bc-section-title" style={{ marginBottom: 6 }}>
          <div className="st-left">
            <span className="eyebrow">Real-time</span>Live activity
          </div>
        </div>
        {snapshot.events.length === 0 ? (
          <p className="bc-empty-state">No recent workflow events</p>
        ) : (
          snapshot.events.map((ev) => (
            <div key={ev.id} className="bc-watch-row">
              <div className="bc-watch-left">
                <div className="bc-watch-icon">•</div>
                <div>
                  <div className="bc-watch-name">{ev.message ?? ev.type}</div>
                  <div className="bc-watch-sub">{timeAgo(ev.createdAt)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
