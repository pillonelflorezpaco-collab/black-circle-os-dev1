"use client";

import { useState } from "react";
import type { JarvisPlan } from "@/jarvis/types";
import { JarvisResult } from "./JarvisResult";

type PanelState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "success"; plan: JarvisPlan };

/**
 * Command interface shell for Jarvis. Calls /api/jarvis/plan — a session-
 * authed, PLAN-only proxy to the real Jarvis Core (src/jarvis/core.ts,
 * untouched). Never creates a Task, never triggers the Approval Engine,
 * never executes anything: there is no "CREATE_TASK" affordance here at all.
 *
 * `hero` controls presentation weight only (Command Center vs. a denser
 * embed) — the behavior is identical either way.
 */
export function JarvisPanel({ hero = false, onResult }: { hero?: boolean; onResult?: (message: string, plan: JarvisPlan) => void }) {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<PanelState>({ status: "idle" });

  async function submitPlan() {
    if (!message.trim()) return;
    const sentMessage = message;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/jarvis/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sentMessage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Unknown error." });
        return;
      }
      setState({ status: "success", plan: data.plan });
      onResult?.(sentMessage, data.plan);
    } catch {
      setState({ status: "error", message: "Could not reach Jarvis." });
    }
  }

  return (
    <div className={`bc-card bc-jarvis-panel${hero ? " hero" : ""}`}>
      <div className="bc-jarvis-head">
        <div>
          <div className="bc-jarvis-eyebrow">CIO / Master Orchestrator</div>
          <div className="bc-jarvis-title">Jarvis</div>
        </div>
        <span className="bc-jarvis-mode-pill">
          <span className="dot" /> PLAN mode — no execution
        </span>
      </div>

      <div className="bc-jarvis-input-row">
        <input
          className="bc-jarvis-input"
          type="text"
          placeholder="Ask Jarvis... (e.g. Prepare a content strategy for Shirley this week)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPlan()}
        />
        <button type="button" className="bc-jarvis-plan-btn" onClick={submitPlan} disabled={state.status === "loading" || !message.trim()}>
          {state.status === "loading" ? "…" : "PLAN"}
        </button>
      </div>

      {state.status === "idle" && <p className="bc-jarvis-hint">Jarvis will resolve intent, target, agent, capability and risk — then stop. Nothing executes.</p>}
      {state.status === "error" && <p className="bc-jarvis-error">{state.message}</p>}
      {state.status === "success" && <JarvisResult plan={state.plan} />}
    </div>
  );
}
