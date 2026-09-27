"use client";

import { useActionState, useTransition } from "react";
import { addModelLinkAction, removeModelLinkAction } from "./actions";

type LinkRow = { id: string; label: string; url: string };

export default function ModelLinksSection({ modelId, links, canEdit }: { modelId: string; links: LinkRow[]; canEdit: boolean }) {
  const [error, formAction, pending] = useActionState(addModelLinkAction, undefined);
  const [isRemoving, startTransition] = useTransition();

  return (
    <div>
      {links.length === 0 ? (
        <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Aucun lien pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: canEdit ? 16 : 0 }}>
          {links.map((link) => (
            <div key={link.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <a href={link.url} target="_blank" rel="noreferrer" style={{ color: "var(--bc-amber)", fontSize: 13, textDecoration: "none" }}>
                {link.label}
              </a>
              {canEdit && (
                <button
                  disabled={isRemoving}
                  onClick={() => startTransition(() => removeModelLinkAction(link.id))}
                  style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 11, cursor: isRemoving ? "wait" : "pointer" }}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form action={formAction} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="modelId" value={modelId} />
          <input
            name="label"
            placeholder="Libellé"
            required
            style={{ flex: 1, background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
          />
          <input
            name="url"
            placeholder="https://…"
            required
            style={{ flex: 2, background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
          />
          <button
            type="submit"
            disabled={pending}
            style={{ background: "var(--bc-amber)", color: "#1A1409", border: "none", fontWeight: 600, fontSize: 12.5, padding: "8px 14px", borderRadius: 7, cursor: pending ? "wait" : "pointer" }}
          >
            {pending ? "…" : "Ajouter"}
          </button>
        </form>
      )}
      {error && <p style={{ color: "var(--bc-red)", fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
