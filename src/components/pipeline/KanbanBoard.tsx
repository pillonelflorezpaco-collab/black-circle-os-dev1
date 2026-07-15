"use client";

import { useEffect, useState } from "react";
import { PipelineVideoModal, type PipelineVideoEditTarget } from "./PipelineVideoModal";

type VideoStage = "RAW" | "A_EDITER" | "EN_EDITION" | "PRET_POUR_REVIEW" | "VALIDE" | "PROGRAMME" | "PUBLIE";

type KanbanVideo = {
  id: string;
  title: string;
  stage: VideoStage;
  clientId: string;
  clientName: string;
  editorInitials: string;
  assignedEditorId: string | null;
  driveUrl: string | null;
  caption: string | null;
  lastEditedByName: string | null;
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

export function KanbanBoard({
  initialVideos,
  clients,
  editors,
  canEdit,
  defaultClientId,
}: {
  initialVideos: KanbanVideo[];
  clients: { id: string; name: string }[];
  editors: { id: string; name: string }[];
  canEdit: boolean;
  defaultClientId?: string | null;
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<VideoStage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PipelineVideoEditTarget>(null);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

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

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(v: KanbanVideo) {
    if (!canEdit) return;
    setEditTarget({
      id: v.id,
      title: v.title,
      clientId: v.clientId,
      driveUrl: v.driveUrl,
      caption: v.caption,
      assignedEditorId: v.assignedEditorId,
      stage: v.stage,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
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

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={openCreate}
            style={{
              background: "var(--bc-amber)",
              color: "#1A1409",
              border: "none",
              fontWeight: 600,
              fontSize: 12.5,
              padding: "8px 16px",
              borderRadius: 9,
              cursor: "pointer",
            }}
          >
            + Nouvelle vidéo
          </button>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{v.title}</div>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(v)}
                          title="Modifier"
                          style={{ background: "none", border: "none", color: "var(--bc-text-faint)", cursor: "pointer", fontSize: 12, flexShrink: 0, padding: 0 }}
                        >
                          ✎
                        </button>
                      )}
                    </div>
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
                    {v.lastEditedByName && (
                      <div style={{ marginTop: 6, fontSize: 9.5, color: "var(--bc-text-faint)", fontFamily: "var(--font-jbmono)" }}>
                        modifié par {v.lastEditedByName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <PipelineVideoModal
          target={editTarget}
          clients={clients}
          editors={editors}
          defaultClientId={defaultClientId}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
