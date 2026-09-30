"use client";

import { useMemo, useState, useTransition } from "react";
import { moveBatchStatusAction, updateBatchNoteAction } from "./actions";
import type { EditingBatchView } from "@/services/editorSpace.service";

const COLUMNS: { key: "A_EDITER" | "EN_EDITION" | "PRET_POUR_REVIEW"; label: string; accent: string }[] = [
  { key: "A_EDITER", label: "À éditer", accent: "var(--bc-text-faint)" },
  { key: "EN_EDITION", label: "En édition", accent: "var(--bc-amber)" },
  { key: "PRET_POUR_REVIEW", label: "Prêt pour review", accent: "var(--bc-green)" },
];

const AVATAR_COLORS = ["#d8a864", "#8fb8c9", "#c98f9b", "#a893c9", "#7fae86"];
function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function KanbanBoard({ batches, showEditorName }: { batches: EditingBatchView[]; showEditorName: boolean }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const columns = useMemo(
    () => COLUMNS.map((col) => ({ ...col, items: batches.filter((b) => b.status === col.key) })),
    [batches]
  );
  const openBatch = batches.find((b) => b.id === openId) ?? null;

  function onDrop(status: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = draggingId;
      setDraggingId(null);
      if (!id) return;
      startTransition(() => {
        moveBatchStatusAction(id, status);
      });
    };
  }

  function openCard(batch: EditingBatchView) {
    setOpenId(batch.id);
    setDraftNote(batch.note ?? "");
  }

  function saveNote() {
    if (!openId) return;
    const id = openId;
    startTransition(async () => {
      await updateBatchNoteAction(id, draftNote);
    });
    setOpenId(null);
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(col.key)}
            className="bc-card"
            style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 260 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.accent }} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{col.label}</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--bc-text-faint)" }}>{col.items.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.items.length === 0 && (
                <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 12.5 }}>Vide.</p>
              )}
              {col.items.map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDraggingId(b.id)}
                  onClick={() => openCard(b)}
                  style={{
                    background: "var(--bc-surface-2)",
                    border: "1px solid var(--bc-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: isPending ? "wait" : "grab",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: colorFor(b.modelId),
                        color: "#0a0a0b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {b.modelName.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.modelName}</div>
                      <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>
                        {b.weekLabel}
                        {showEditorName && ` · ${b.editorName ?? "Non assignée"}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>{b.videoCount} vidéo{b.videoCount > 1 ? "s" : ""}</span>
                    {b.note && <span style={{ fontSize: 12, color: "var(--bc-amber)" }}>✎</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {openBatch && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setOpenId(null)}
        >
          <div
            className="bc-card"
            style={{ width: 440, display: "flex", flexDirection: "column", gap: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: colorFor(openBatch.modelId),
                    color: "#0a0a0b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {openBatch.modelName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{openBatch.modelName}</div>
                  <div style={{ fontSize: 11, color: "var(--bc-text-faint)" }}>
                    {openBatch.weekLabel} · {openBatch.videoCount} vidéos
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Fermer" style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--bc-text-faint)", marginBottom: 6 }}>Note</div>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Ex : il manque 3 vidéos, qualité audio à revoir sur les 2 dernières…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 90,
                  background: "var(--bc-surface-2)",
                  border: "1px solid var(--bc-border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "var(--bc-text)",
                  fontSize: 13,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setOpenId(null)} className="bc-plat-chip" style={{ cursor: "pointer" }}>
                Annuler
              </button>
              <button
                type="button"
                onClick={saveNote}
                style={{ background: "var(--bc-amber)", border: "none", color: "#1a1206", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
