"use client";

import { useState } from "react";
import type { JarvisPlan } from "@/jarvis/types";
import { JarvisPanel } from "./JarvisPanel";
import { JarvisResult } from "./JarvisResult";

interface HistoryEntry {
  message: string;
  plan: JarvisPlan;
  at: Date;
}

/**
 * The dedicated Jarvis workspace (/jarvis) — distinct from the Command
 * Center's embedded panel by keeping a running list of this session's plans
 * below the input. This is in-memory React state only: it resets on reload
 * and is never sent anywhere for storage. No persistent Jarvis history model
 * exists yet (Task Engine/Approval Engine only persist Tasks/Approvals, not
 * conversation turns) — this is deliberately NOT presented as saved history.
 */
export function JarvisWorkspace() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  return (
    <>
      <JarvisPanel hero onResult={(message, plan) => setHistory((prev) => [{ message, plan, at: new Date() }, ...prev].slice(0, 20))} />

      {history.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="bc-section-title">
            <div className="st-left">
              <span className="eyebrow">This session</span>Previous plans
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--bc-text-faint)", marginTop: -8, marginBottom: 14 }}>
            Kept in this browser tab only — not saved. No persistent Jarvis history exists yet.
          </p>
          {history.map((entry, i) => (
            <div className="bc-card" key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: "var(--bc-text-dim)", marginBottom: 8, fontStyle: "italic" }}>
                &ldquo;{entry.message}&rdquo; <span style={{ color: "var(--bc-text-faint)" }}>— {entry.at.toLocaleTimeString()}</span>
              </div>
              <JarvisResult plan={entry.plan} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
