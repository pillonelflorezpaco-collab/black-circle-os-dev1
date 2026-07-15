"use client";

import { useActionState } from "react";
import { addTeamMember } from "./actions";

const ROLES = ["ADMIN", "MANAGER", "ASSISTANT", "MONTEUR", "VIEWER"];

export default function TeamMemberForm() {
  const [error, formAction, pending] = useActionState(addTeamMember, undefined);

  return (
    <div className="bc-card" style={{ marginBottom: 22 }}>
      <div className="bc-section-title" style={{ marginBottom: 14 }}>
        <div className="st-left">
          <span className="eyebrow">Équipe</span>Ajouter un employé
        </div>
      </div>
      <form action={formAction} className="bc-form-grid">
        <div>
          <label>Nom complet</label>
          <input name="name" required />
        </div>
        <div>
          <label>Email</label>
          <input name="email" type="email" required />
        </div>
        <div>
          <label>Mot de passe temporaire</label>
          <input name="password" type="password" required minLength={8} />
        </div>
        <div>
          <label>Rôle</label>
          <select name="role" defaultValue="MONTEUR">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="full" style={{ color: "var(--bc-red)", fontSize: 12.5 }}>
            {error}
          </div>
        )}
        <div className="full">
          <button
            type="submit"
            disabled={pending}
            style={{
              background: "var(--bc-amber)",
              color: "#1A1409",
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              padding: "10px 18px",
              borderRadius: 9,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Création…" : "+ Ajouter l'employé"}
          </button>
        </div>
      </form>
    </div>
  );
}
