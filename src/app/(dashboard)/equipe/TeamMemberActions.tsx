"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { updateTeamMemberRoleAction, removeTeamMemberAction } from "./actions";

const ROLES: Role[] = [
  "OWNER",
  "AGENCY_MANAGER",
  "CONTENT_MANAGER",
  "EDITOR",
  "VIDEO_EDITOR",
  "ASSISTANT",
  "CLOSER",
  "SALES",
  "CHATTER_MANAGER",
  "CHATTER",
  "FINANCE",
  "DEVELOPER",
];

export default function TeamMemberActions({ userId, role }: { userId: string; role: Role }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        defaultValue={role}
        disabled={isPending}
        onChange={(e) => startTransition(() => updateTeamMemberRoleAction(userId, e.target.value as Role))}
        style={{
          background: "var(--bc-surface-2)",
          border: "1px solid var(--bc-border)",
          color: "var(--bc-text)",
          fontSize: 11.5,
          padding: "4px 6px",
          borderRadius: 6,
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {confirming ? (
        <>
          <span style={{ fontSize: 11.5, color: "var(--bc-text-dim)" }}>Confirmer ?</span>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => removeTeamMemberAction(userId))}
            style={{ background: "none", border: "none", color: "var(--bc-red)", fontSize: 12, fontWeight: 600, cursor: isPending ? "wait" : "pointer" }}
          >
            Oui
          </button>
          <button
            disabled={isPending}
            onClick={() => setConfirming(false)}
            style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 12, cursor: "pointer" }}
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          disabled={isPending}
          onClick={() => setConfirming(true)}
          style={{ background: "none", border: "none", color: "var(--bc-red)", fontSize: 12, cursor: "pointer" }}
        >
          Retirer
        </button>
      )}
    </div>
  );
}
