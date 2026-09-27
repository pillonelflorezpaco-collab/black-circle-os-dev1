"use client";

import { useState, useTransition } from "react";
import { assignModelUserAction, unassignModelUserAction } from "./actions";

type AssignmentRow = { id: string; user: { id: string; name: string; role: string } };
type AssignableUser = { id: string; name: string; role: string };

export default function ModelAssignmentsSection({
  modelId,
  assignments,
  assignableUsers,
  canEdit,
}: {
  modelId: string;
  assignments: AssignmentRow[];
  assignableUsers: AssignableUser[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState(assignableUsers[0]?.id ?? "");

  return (
    <div>
      {assignments.length === 0 ? (
        <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Personne d&apos;assigné pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: canEdit ? 16 : 0 }}>
          {assignments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13 }}>
                {a.user.name} <span style={{ color: "var(--bc-text-faint)", fontSize: 11 }}>({a.user.role})</span>
              </span>
              {canEdit && (
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => unassignModelUserAction(a.id))}
                  style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 11, cursor: isPending ? "wait" : "pointer" }}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit &&
        (assignableUsers.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontSize: 12 }}>Tous les membres de l&apos;agence sont déjà assignés.</p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ flex: 1, background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <button
              disabled={isPending || !selectedUserId}
              onClick={() => startTransition(() => assignModelUserAction(modelId, selectedUserId))}
              style={{ background: "var(--bc-amber)", color: "#1A1409", border: "none", fontWeight: 600, fontSize: 12.5, padding: "8px 14px", borderRadius: 7, cursor: isPending ? "wait" : "pointer" }}
            >
              {isPending ? "…" : "Assigner"}
            </button>
          </div>
        ))}
    </div>
  );
}
