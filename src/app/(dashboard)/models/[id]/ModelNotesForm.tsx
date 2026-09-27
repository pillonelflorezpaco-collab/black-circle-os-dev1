"use client";

import { useState, useTransition } from "react";
import { updateModelNotesAction } from "./actions";

export default function ModelNotesForm({ modelId, notes, canEdit }: { modelId: string; notes: string | null; canEdit: boolean }) {
  const [value, setValue] = useState(notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      const result = await updateModelNotesAction(modelId, value);
      setError(result);
      if (!result) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  if (!canEdit) {
    return (
      <p style={{ color: "var(--bc-text-dim)", fontSize: 13, whiteSpace: "pre-wrap" }}>
        {notes || <span style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucune note.</span>}
      </p>
    );
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Notes libres sur ce model…"
        style={{
          width: "100%",
          background: "var(--bc-surface-2)",
          border: "1px solid var(--bc-border)",
          color: "var(--bc-text)",
          padding: "11px 12px",
          borderRadius: 8,
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            background: "var(--bc-amber)",
            color: "#1A1409",
            border: "none",
            fontWeight: 600,
            fontSize: 12.5,
            padding: "8px 14px",
            borderRadius: 8,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span style={{ color: "var(--bc-green)", fontSize: 12 }}>Enregistré ✓</span>}
        {error && <span style={{ color: "var(--bc-red)", fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}
