"use client";

import { useState } from "react";

type VideoStage = "RAW" | "A_EDITER" | "EN_EDITION" | "PRET_POUR_REVIEW" | "VALIDE" | "PROGRAMME" | "PUBLIE";

type KanbanVideo = {
  id: string;
  title: string;
  stage: VideoStage;
  clientName: string;
  editorInitials: string;
};

const COLUMNS: { stage: VideoStage; label: string }[] = [
  { stage: "RAW", label: "Raw" },
  { stage: "A_EDITER", label: "À éditer" },
  { stage: "EN_EDITION", label: "En édition" },
  { stage: "PRET_POUR_REVIEW", label: "Prêt pour review" },
  { stage: "VALIDE", label: "Validé" },
  { stage: "PROGRAMME", label: "Programmé" },
  { stage: "PUBLIE", label: "Publié" },
];

export function KanbanBoard({ initialVideos }: { initialVideos: KanbanVideo[] }) {
  const [videos, setVideos] = useState(initialVideos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<VideoStage | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function moveTo(id: string, stage: VideoStage) {
    const prev = videos;
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, stage } : v)));

    try {
      const res = await fetch(`/api/videos/${id}/stage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error(await res.text());

      if (stage === "PRET_POUR_REVIEW") {
        setToast("Notification envoyée (Google Calendar + Telegram) — vérifie Automatisations si les identifiants ne sont pas encore configurés.");
        setTimeout(() => setToast(null), 5000);
      }
    } catch {
      setVideos(prev); // roll back on failure
      setToast("Échec de la mise à jour — réessaie.");
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--bc-surface-2)",
            border: "1px solid var(--bc-border)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 12.5,
            color: "var(--bc-text)",
            maxWidth: 320,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,.4)",
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {COLUMNS.map((col) => {
          const items = videos.filter((v) => v.stage === col.stage);
          const isOver = dragOverStage === col.stage;
          return (
            <div
              key={col.stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(col.stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === col.stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (dragId) moveTo(dragId, col.stage);
                setDragId(null);
              }}
              style={{
                background: "var(--bc-surface)",
                border: `1px solid ${isOver ? "var(--bc-amber-dim)" : "var(--bc-border)"}`,
                borderRadius: 14,
                width: 220,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                maxHeight: 620,
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--bc-border)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{col.label}</span>
                <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 10, color: "var(--bc-text-faint)", background: "var(--bc-surface-2)", padding: "1px 7px", borderRadius: 8 }}>
                  {items.length}
                </span>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, minHeight: 60 }}>
                {items.map((v) => (
                  <div
                    key={v.id}
                    draggable
                    onDragStart={() => setDragId(v.id)}
                    onDragEnd={() => setDragId(null)}
                    style={{
                      background: "var(--bc-surface-2)",
                      border: "1px solid var(--bc-border)",
                      borderRadius: 10,
                      padding: "10px 11px",
                      cursor: "grab",
                      opacity: dragId === v.id ? 0.4 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{v.title}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "var(--bc-amber)", fontFamily: "var(--font-jbmono)" }}>{v.clientName}</span>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          background: "var(--bc-surface-3, #191919)",
                          color: "var(--bc-text-dim)",
                          fontSize: 8,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-jbmono)",
                        }}
                      >
                        {v.editorInitials}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
