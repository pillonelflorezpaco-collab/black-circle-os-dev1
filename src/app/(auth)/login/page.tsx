"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticate } from "./actions";

export default function LoginPage() {
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <div
      style={{
        width: 380,
        background: "var(--bc-surface)",
        border: "1px solid var(--bc-border)",
        borderRadius: "var(--bc-radius)",
        padding: 34,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 26 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.2" stroke="var(--bc-amber)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.1" fill="var(--bc-amber)" />
        </svg>
        <div>
          <div className="bc-logo-word">
            Black Circle <b>OS</b>
          </div>
          <div className="bc-logo-sub">Control Center</div>
        </div>
      </div>

      <form action={formAction} className="bc-form-grid">
        <input type="hidden" name="from" value={from} />
        <div className="full">
          <label>Email</label>
          <input name="email" type="email" required autoComplete="email" placeholder="prenom@blackcircle.agency" />
        </div>
        <div className="full">
          <label>Mot de passe</label>
          <input name="password" type="password" required autoComplete="current-password" />
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
              width: "100%",
              background: "var(--bc-amber)",
              color: "#1A1409",
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              padding: "11px 16px",
              borderRadius: 9,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
