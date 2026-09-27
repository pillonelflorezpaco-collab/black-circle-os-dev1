"use client";

import { useState, useTransition } from "react";
import { regenerateAccessCode } from "./actions";

export default function AccessCodeControl({ modelId, accessCode }: { modelId: string; accessCode: string | null }) {
  const [code, setCode] = useState(accessCode);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleRegenerate() {
    startTransition(async () => {
      const newCode = await regenerateAccessCode(modelId);
      setCode(newCode);
      setCopied(false);
    });
  }

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontFamily: "var(--font-jbmono)", fontSize: 11 }}
    >
      <span style={{ color: "var(--bc-text-faint)" }}>Code portail:</span>
      {code ? (
        <button
          onClick={handleCopy}
          style={{ background: "var(--bc-surface-2)", border: "1px solid var(--bc-border)", color: "var(--bc-amber)", borderRadius: 5, padding: "2px 6px", cursor: "pointer" }}
        >
          {copied ? "Copié !" : code}
        </button>
      ) : (
        <span style={{ color: "var(--bc-text-faint)" }}>Aucun</span>
      )}
      <button
        onClick={handleRegenerate}
        disabled={isPending}
        style={{ background: "none", border: "none", color: "var(--bc-text-dim)", cursor: isPending ? "wait" : "pointer", textDecoration: "underline" }}
      >
        {isPending ? "…" : code ? "Régénérer" : "Générer"}
      </button>
    </div>
  );
}
