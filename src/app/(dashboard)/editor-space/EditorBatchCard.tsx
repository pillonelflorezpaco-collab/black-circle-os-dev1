"use client";

import { useTransition } from "react";
import { advanceEditorVideoStageAction } from "./actions";
import type { EditorBatch } from "@/services/editorSpace.service";

// Local copy of the labels from video.service.ts's STAGE_LABELS — kept separate
// so this client component never pulls in that (server-only, Prisma-backed) module.
const STAGE_LABELS: Record<string, string> = {
  RAW: "Raw",
  A_EDITER: "À éditer",
  EN_EDITION: "En édition",
  PRET_POUR_REVIEW: "Prêt pour review",
  VALIDE: "Validé",
  PROGRAMME: "Programmé",
  PUBLIE: "Publié",
};

const STAGE_CLASS: Record<string, string> = {
  A_EDITER: "",
  EN_EDITION: "pending",
  PRET_POUR_REVIEW: "ok",
};

export default function EditorBatchCard({ batch, showEditorName }: { batch: EditorBatch; showEditorName: boolean }) {
  const [isPending, startTransition] = useTransition();

  function advance(videoId: string) {
    startTransition(async () => {
      await advanceEditorVideoStageAction(videoId);
    });
  }

  return (
    <div className="bc-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{batch.modelName}</div>
          <div style={{ fontSize: 11.5, color: "var(--bc-text-faint)" }}>
            {batch.weekLabel}
            {showEditorName && ` · ${batch.editorName ?? "Non assignée"}`}
          </div>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--bc-text-faint)" }}>{batch.videos.length} fichier{batch.videos.length > 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {batch.videos.map((v) => {
          const next = v.stage === "A_EDITER" ? "EN_EDITION" : v.stage === "EN_EDITION" ? "PRET_POUR_REVIEW" : null;
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 4px", borderBottom: "1px solid var(--bc-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span className={`bc-status-pill ${STAGE_CLASS[v.stage] ?? ""}`} style={{ fontSize: 10 }}>
                  {STAGE_LABELS[v.stage]}
                </span>
                <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {v.driveUrl && (
                  <a href={v.driveUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--bc-amber)" }}>
                    Drive
                  </a>
                )}
                {next && (
                  <button type="button" disabled={isPending} onClick={() => advance(v.id)} className="bc-plat-chip" style={{ cursor: "pointer", fontSize: 11.5 }}>
                    → {STAGE_LABELS[next]}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
