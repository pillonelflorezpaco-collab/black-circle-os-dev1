import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getEditingBatches, getEditedVideoCountByWeek } from "@/services/editorSpace.service";
import KanbanBoard from "./KanbanBoard";

export default async function EditorSpacePage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "editerPipeline")) notFound();

  const agencyId = await getEffectiveAgencyId();
  const isManager = can(session.user.role, "gererEquipe");
  const batches = await getEditingBatches(agencyId, isManager ? undefined : session.user.id);
  const editedCounts = isManager ? [] : await getEditedVideoCountByWeek(session.user.id, agencyId);

  const totalVideos = batches.reduce((s, b) => s + b.videoCount, 0);
  const aEditerVideos = batches.filter((b) => b.status === "A_EDITER").reduce((s, b) => s + b.videoCount, 0);
  const enEditionVideos = batches.filter((b) => b.status === "EN_EDITION").reduce((s, b) => s + b.videoCount, 0);
  const pretVideos = batches.filter((b) => b.status === "PRET_POUR_REVIEW").reduce((s, b) => s + b.videoCount, 0);
  const progressPct = totalVideos > 0 ? Math.round((pretVideos / totalVideos) * 100) : 0;

  return (
    <>
      <div className="bc-topbar">
        <h2>Espace Éditrice</h2>
        <div className="bc-status">
          <span className="dot" />
          {isManager ? "Vue équipe" : "Mes blocs assignés"}
        </div>
      </div>

      <div className="bc-card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 22 }}>{totalVideos}</div>
          <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>vidéos en cours</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 22, color: "var(--bc-green)" }}>{pretVideos}</div>
          <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>déjà éditées</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 22, color: "var(--bc-amber)" }}>{progressPct}%</div>
          <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>avancement</div>
        </div>

        {totalVideos > 0 && (
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--bc-surface-2)" }}>
              <div style={{ width: `${(pretVideos / totalVideos) * 100}%`, background: "var(--bc-green)" }} />
              <div style={{ width: `${(enEditionVideos / totalVideos) * 100}%`, background: "var(--bc-amber)" }} />
              <div style={{ width: `${(aEditerVideos / totalVideos) * 100}%`, background: "var(--bc-border-strong)" }} />
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--bc-text-faint)" }}>
              <span>● Prêt {pretVideos}</span>
              <span>● En édition {enEditionVideos}</span>
              <span>● À éditer {aEditerVideos}</span>
            </div>
          </div>
        )}
      </div>

      {!isManager && editedCounts.length > 0 && (
        <div className="bc-card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--bc-text-faint)", marginBottom: 10 }}>
            Vidéos éditées par semaine
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {editedCounts.map((e) => (
              <div key={e.weekLabel}>
                <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 16 }}>{e.count}</div>
                <div style={{ fontSize: 10, color: "var(--bc-text-faint)" }}>{e.weekLabel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="bc-card">
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>
            {isManager ? "Aucun bloc en cours d'édition pour l'instant." : "Aucun bloc ne vous est assigné pour l'instant."}
          </p>
        </div>
      ) : (
        <KanbanBoard batches={batches} showEditorName={isManager} />
      )}
    </>
  );
}
