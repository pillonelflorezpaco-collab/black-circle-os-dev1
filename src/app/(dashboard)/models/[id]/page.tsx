import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelDetail } from "@/services/model.service";
import { STAGE_LABELS } from "@/services/video.service";
import { PLATFORM_COLOR } from "@/services/post.service";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import AccessCodeControl from "../AccessCodeControl";
import ModelNotesForm from "./ModelNotesForm";
import ModelLinksSection from "./ModelLinksSection";
import ModelAssignmentsSection from "./ModelAssignmentsSection";

const STATUS_LABEL: Record<string, string> = { OK: "Sain", WARN: "Attention", CRIT: "Critique" };
const STATUS_CLASS: Record<string, string> = { OK: "ok", WARN: "warn", CRIT: "crit" };

function severityIcon(severity: "OK" | "WARN" | "CRIT") {
  if (severity === "OK") return "dot-ok";
  if (severity === "WARN") return "dot-warn";
  return "dot-crit";
}

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !can(session.user.role, "voirModels")) notFound();

  const agencyId = await getEffectiveAgencyId();
  const model = await getModelDetail(id, agencyId);
  if (!model) notFound();

  const canEdit = can(session.user.role, "gererModels");

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <Link href="/models" style={{ color: "var(--bc-text-faint)", fontSize: 16, marginRight: 10, textDecoration: "none" }}>
            ←
          </Link>
          {model.name}
        </h2>
        <div className="bc-status">
          <span className="dot" />
          {model.teamName}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="bc-cc-avatar">{model.initials}</div>
          <span className={`bc-cc-status ${STATUS_CLASS[model.status]}`}>{STATUS_LABEL[model.status]}</span>
        </div>
        <AccessCodeControl modelId={model.id} accessCode={model.accessCode} />
      </div>

      <div className="bc-form-grid" style={{ marginBottom: 24 }}>
        <div className="bc-mini-card">
          <div className="lab">Vidéos dispo.</div>
          <div className="val">{model.videoCount}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Jours restants</div>
          <div className={`val ${model.status === "CRIT" ? "neg" : model.status === "WARN" ? "amber" : "pos"}`}>
            {model.daysRemaining.toFixed(1).replace(".", ",")}
            <span className="unit">jours</span>
          </div>
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Pipeline</span>Contenu par étape
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 14 }}>
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <div key={stage} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 20, color: "var(--bc-text)" }}>
                {model.videosByStage[stage] ?? 0}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--bc-text-faint)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Connectés</span>Comptes sociaux
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        {model.socialAccounts.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Aucun compte connecté.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {model.socialAccounts.map((sa) => (
              <div key={sa.id} className="bc-plat-chip">
                <span className="pc-dot" style={{ background: PLATFORM_COLOR[sa.platform] ?? "#8C8A85" }} />
                {sa.displayName ?? sa.platform}
                <span style={{ fontSize: 10, color: "var(--bc-text-faint)" }}>{sa.source === "NATIVE" ? "Natif" : "Blotato"}</span>
                {!sa.isActive && <span style={{ fontSize: 10, color: "var(--bc-red)" }}>· inactif</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Équipe</span>Assigné à ce model
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        <ModelAssignmentsSection modelId={model.id} assignments={model.assignments} assignableUsers={model.assignableUsers} canEdit={canEdit} />
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Notion-style</span>Liens
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        <ModelLinksSection modelId={model.id} links={model.links} canEdit={canEdit} />
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Notes</span>Notes libres
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        <ModelNotesForm modelId={model.id} notes={model.notes} canEdit={canEdit} />
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Temps réel</span>Activité récente
        </div>
      </div>
      <div className="bc-card">
        {model.activity.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucune activité pour le moment.</p>
        ) : (
          model.activity.map((entry) => (
            <div key={entry.id} className="bc-watch-row">
              <div className="bc-watch-left">
                <div className={`bc-watch-icon ${severityIcon(entry.severity)}`}>•</div>
                <div>
                  <div className="bc-watch-name">{entry.message}</div>
                  {entry.actor && <div className="bc-watch-sub">{entry.actor.name}</div>}
                </div>
              </div>
              <div className="bc-watch-right">
                <div className="bc-watch-amt">{new Date(entry.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
