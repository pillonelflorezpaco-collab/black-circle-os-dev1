"use client";

import { useActionState } from "react";
import { authenticatePortal } from "./actions";

export default function PortailLoginPage() {
  const [error, formAction, pending] = useActionState(authenticatePortal, undefined);

  return (
    <div
      style={{
        marginTop: "18vh",
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
          <div className="bc-logo-sub">Espace client</div>
        </div>
      </div>

      <form action={formAction} className="bc-form-grid">
        <div className="full">
          <label>Code d&apos;accès</label>
          <input
            name="code"
            required
            autoComplete="off"
            placeholder="ex: A1B2C3D4"
            style={{ textTransform: "uppercase", letterSpacing: 2 }}
          />
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
            {pending ? "Connexion…" : "Accéder à mon espace"}
          </button>
        </div>
      </form>
    </div>
  );
}
