"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createVideoAction, updateVideoAction, deleteVideoAction } from "@/app/(dashboard)/pipeline/actions";

export type PipelineVideoEditTarget = {
  id: string;
  title: string;
  clientId: string;
  driveUrl: string | null;
  caption: string | null;
  assignedEditorId: string | null;
  stage: string;
} | null;

const STAGES = [
  { value: "RAW", label: "Raw" },
  { value: "A_EDITER", label: "À éditer" },
  { value: "EN_EDITION", label: "En édition" },
  { value: "PRET_POUR_REVIEW", label: "Prêt pour review" },
  { value: "VALIDE", label: "Validé" },
  { value: "PROGRAMME", label: "Programmé" },
  { value: "PUBLIE", label: "Publié" },
];

export function PipelineVideoModal({
  target,
  clients,
  editors,
  defaultClientId,
  onClose,
}: {
  target: PipelineVideoEditTarget; // null = create mode
  clients: { id: string; name: string }[];
  editors: { id: string; name: string }[];
  defaultClientId?: string | null;
  onClose: () => void;
}) {
  const isEdit = !!target;
  const action = isEdit ? updateVideoAction : createVideoAction;
  const [error, formAction, pending] = useActionState(action, undefined);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !error) onClose();
    wasPending.current = pending;
  }, [pending, error, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bc-card"
        style={{ width: 460, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}
      >
        <div className="bc-section-title" style={{ marginBottom: 14 }}>
          <div className="st-left">
            <span className="eyebrow">Pipeline</span>
            {isEdit ? "Modifier la vidéo" : "Nouvelle vidéo"}
          </div>
        </div>

        <form
          action={(fd) => {
            if (isEdit) fd.set("videoId", target!.id);
            formAction(fd);
          }}
          className="bc-form-grid"
        >
          <div className="full">
            <label>Titre</label>
            <input name="title" required defaultValue={target?.title ?? ""} />
          </div>
          <div>
            <label>Client</label>
            <select name="clientId" required defaultValue={target?.clientId ?? defaultClientId ?? clients[0]?.id ?? ""}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Éditeur assigné</label>
            <select name="assignedEditorId" defaultValue={target?.assignedEditorId ?? ""}>
              <option value="">— Aucun —</option>
              {editors.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          {!isEdit && (
            <div>
              <label>Étape initiale</label>
              <select name="stage" defaultValue="RAW">
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="full">
            <label>Lien (Drive, etc.)</label>
            <input name="driveUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={target?.driveUrl ?? ""} />
          </div>
          <div className="full">
            <label>Légende / notes</label>
            <input name="caption" defaultValue={target?.caption ?? ""} />
          </div>

          {error && (
            <div className="full" style={{ color: "var(--bc-red)", fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <div className="full" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            {isEdit ? (
              confirmingDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--bc-text-dim)" }}>Confirmer ?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      startDeleteTransition(async () => {
                        await deleteVideoAction(target!.id);
                        onClose();
                      });
                    }}
                    style={{ background: "none", border: "none", color: "var(--bc-red)", fontSize: 12.5, fontWeight: 600, cursor: isDeleting ? "wait" : "pointer" }}
                  >
                    {isDeleting ? "Suppression…" : "Oui"}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmingDelete(false)}
                    style={{ background: "none", border: "none", color: "var(--bc-text-faint)", fontSize: 12.5, cursor: "pointer" }}
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  style={{ background: "none", border: "none", color: "var(--bc-red)", fontSize: 12.5, cursor: "pointer" }}
                >
                  Supprimer
                </button>
              )
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "var(--bc-surface-2)", color: "var(--bc-text-dim)", border: "1px solid var(--bc-border)", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: 9, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending}
                style={{
                  background: "var(--bc-amber)",
                  color: "#1A1409",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: "9px 18px",
                  borderRadius: 9,
                  cursor: pending ? "wait" : "pointer",
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "+ Créer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
