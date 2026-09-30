import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getEditorSpaceBatches, getEditedCountByWeek } from "@/services/editorSpace.service";
import EditorBatchCard from "./EditorBatchCard";

export default async function EditorSpacePage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "editerPipeline")) notFound();

  const agencyId = await getEffectiveAgencyId();
  const isManager = can(session.user.role, "gererEquipe");
  const batches = await getEditorSpaceBatches(agencyId, isManager ? undefined : session.user.id);
  const editedCounts = isManager ? [] : await getEditedCountByWeek(session.user.id, agencyId);

  const byModel = new Map<string, typeof batches>();
  for (const b of batches) {
    if (!byModel.has(b.modelId)) byModel.set(b.modelId, []);
    byModel.get(b.modelId)!.push(b);
  }

  return (
    <>
      <div className="bc-topbar">
        <h2>Espace Éditrice</h2>
        <div className="bc-status">
          <span className="dot" />
          {isManager ? "Vue équipe" : "Mes vidéos assignées"}
        </div>
      </div>

      {!isManager && editedCounts.length > 0 && (
        <div className="bc-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--bc-text-faint)", marginBottom: 10 }}>
            Vidéos éditées par semaine
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {editedCounts.map((e) => (
              <div key={e.weekLabel}>
                <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 18 }}>{e.count}</div>
                <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)" }}>{e.weekLabel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="bc-card">
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>
            {isManager ? "Aucune vidéo en cours d'édition pour l'instant." : "Aucune vidéo ne vous est assignée pour l'instant."}
          </p>
        </div>
      ) : (
        Array.from(byModel.entries()).map(([modelId, modelBatches]) => (
          <div key={modelId} style={{ marginBottom: 8 }}>
            {modelBatches.map((batch) => (
              <EditorBatchCard key={batch.key} batch={batch} showEditorName={isManager} />
            ))}
          </div>
        ))
      )}
    </>
  );
}
