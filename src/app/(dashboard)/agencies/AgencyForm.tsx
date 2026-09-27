"use client";

import { useActionState } from "react";
import { createAgencyAction } from "./actions";

export default function AgencyForm() {
  const [error, formAction, pending] = useActionState(createAgencyAction, undefined);

  return (
    <div className="bc-card" style={{ marginBottom: 22 }}>
      <div className="bc-section-title" style={{ marginBottom: 14 }}>
        <div className="st-left">
          <span className="eyebrow">Agences</span>Ajouter une agence
        </div>
      </div>
      <form action={formAction} className="bc-form-grid">
        <div>
          <label>Nom de l&apos;agence</label>
          <input name="name" required />
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
            {pending ? "Création…" : "+ Ajouter l'agence"}
          </button>
        </div>
      </form>
    </div>
  );
}
