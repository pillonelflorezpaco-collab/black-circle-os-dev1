"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The only new behavior in this increment: human-facing Approve/Reject
 * buttons wired to the existing, already-correct
 * /api/approvals/[id]/{approve,reject} routes (session-authed,
 * approuverTaches-checked, agency-scoped — unchanged by this component).
 * Never executes anything itself; calling approve only flips
 * Approval.status/Task.status, exactly as those routes already document.
 */
export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ status: "idle" | "pending" | "error"; message?: string }>({ status: "idle" });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function handleApprove() {
    setState({ status: "pending" });
    try {
      const res = await fetch(`/api/approvals/${approvalId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Erreur inconnue." });
        return;
      }
      router.refresh();
    } catch {
      setState({ status: "error", message: "Impossible de contacter le serveur." });
    }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setState({ status: "pending" });
    try {
      const res = await fetch(`/api/approvals/${approvalId}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Erreur inconnue." });
        return;
      }
      router.refresh();
    } catch {
      setState({ status: "error", message: "Impossible de contacter le serveur." });
    }
  }

  const busy = state.status === "pending";

  if (rejecting) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          placeholder="Motif du refus…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          style={{ background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", borderRadius: 5, padding: "3px 6px", fontSize: 11, width: 140 }}
        />
        <button
          type="button"
          onClick={handleReject}
          disabled={busy || !reason.trim()}
          style={{ background: "var(--bc-red)", border: "none", color: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "…" : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRejecting(false);
            setReason("");
            setState({ status: "idle" });
          }}
          disabled={busy}
          style={{ background: "none", border: "none", color: "var(--bc-text-faint)", cursor: "pointer", fontSize: 11 }}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          style={{ background: "var(--bc-amber)", border: "none", color: "#000", borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "…" : "Approuver"}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          disabled={busy}
          style={{ background: "none", border: "1px solid var(--bc-border)", color: "var(--bc-text-dim)", borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: busy ? "wait" : "pointer" }}
        >
          Refuser
        </button>
      </div>
      {state.status === "error" && <span style={{ color: "var(--bc-red)", fontSize: 10.5 }}>{state.message}</span>}
    </div>
  );
}
