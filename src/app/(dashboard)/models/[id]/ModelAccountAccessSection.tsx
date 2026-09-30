"use client";

import { useActionState, useState, useTransition } from "react";
import { addSocialAccountAccessAction, removeSocialAccountAccessAction, revealSocialAccountPasswordAction } from "./actions";

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "TWITTER", "PINTEREST", "THREADS", "LINKEDIN", "BLUESKY"] as const;

type AccountRow = {
  id: string;
  platform: string;
  displayName: string | null;
  isMotherAccount: boolean;
  loginIdentifier: string | null;
  hasPassword: boolean;
};

function PasswordReveal({ accountId }: { accountId: string }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revealed) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <code style={{ fontSize: 12, background: "var(--bc-surface)", padding: "2px 6px", borderRadius: 4 }}>{revealed}</code>
        <button type="button" onClick={() => setRevealed(null)} style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 11, cursor: "pointer" }}>
          Masquer
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => setRevealed(await revealSocialAccountPasswordAction(accountId)))}
      style={{ background: "none", border: "1px solid var(--bc-border)", color: "var(--bc-amber)", fontSize: 11, padding: "2px 8px", borderRadius: 5, cursor: pending ? "wait" : "pointer" }}
    >
      {pending ? "…" : "Afficher le mot de passe"}
    </button>
  );
}

export default function ModelAccountAccessSection({ modelId, accounts, canEdit }: { modelId: string; accounts: AccountRow[]; canEdit: boolean }) {
  const [error, formAction, pending] = useActionState(addSocialAccountAccessAction, undefined);
  const [isRemoving, startRemoving] = useTransition();

  const byPlatform = new Map<string, AccountRow[]>();
  for (const acc of accounts) {
    const list = byPlatform.get(acc.platform) ?? [];
    list.push(acc);
    byPlatform.set(acc.platform, list);
  }

  return (
    <div>
      {accounts.length === 0 ? (
        <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13, marginBottom: canEdit ? 14 : 0 }}>Aucun accès de compte enregistré.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: canEdit ? 16 : 0 }}>
          {[...byPlatform.entries()].map(([platform, list]) => (
            <div key={platform}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--bc-text-faint)", marginBottom: 6 }}>{platform}</div>
              {list.map((acc) => (
                <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--bc-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {acc.isMotherAccount && <span className="bc-status-pill ok">Compte mère</span>}
                    <span style={{ fontSize: 13 }}>{acc.displayName ?? acc.loginIdentifier ?? "—"}</span>
                    {acc.loginIdentifier && <span style={{ fontSize: 11.5, color: "var(--bc-text-faint)" }}>{acc.loginIdentifier}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {acc.hasPassword && <PasswordReveal accountId={acc.id} />}
                    {canEdit && (
                      <button
                        disabled={isRemoving}
                        onClick={() => startRemoving(() => removeSocialAccountAccessAction(acc.id))}
                        style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 11, cursor: isRemoving ? "wait" : "pointer" }}
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="modelId" value={modelId} />
          <select name="platform" required style={{ background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            name="displayName"
            placeholder="Nom du compte (ex: @modele.principal)"
            style={{ flex: "1 1 180px", background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
          />
          <input
            name="loginIdentifier"
            placeholder="Email / identifiant de connexion"
            style={{ flex: "1 1 180px", background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
          />
          <input
            name="loginPassword"
            type="password"
            placeholder="Mot de passe"
            style={{ flex: "1 1 140px", background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-text)", padding: "8px 10px", borderRadius: 7, fontSize: 12.5 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--bc-text-dim)" }}>
            <input type="checkbox" name="isMotherAccount" /> Compte mère
          </label>
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
