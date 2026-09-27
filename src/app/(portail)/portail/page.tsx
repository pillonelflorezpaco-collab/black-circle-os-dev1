import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyModelSession } from "@/lib/modelSession";
import { prisma } from "@/lib/prisma";
import { getModelStageCounts, STAGE_LABELS } from "@/services/video.service";
import { listModelPosts } from "@/services/post.service";
import { logoutPortal } from "./actions";

const POST_STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  SCHEDULED: "Programmé",
  IN_PROGRESS: "En cours",
  PUBLISHED: "Publié",
  FAILED: "Échec",
};

const POST_STATUS_CLASS: Record<string, string> = {
  PENDING: "warn",
  SCHEDULED: "warn",
  IN_PROGRESS: "warn",
  PUBLISHED: "ok",
  FAILED: "crit",
};

export default async function PortailDashboardPage() {
  const store = await cookies();
  const modelId = await verifyModelSession(store.get("bc_portal_session")?.value);
  if (!modelId) redirect("/portail/login");

  const model = await prisma.model.findUnique({ where: { id: modelId }, select: { name: true } });
  if (!model) redirect("/portail/login");

  const [stageCounts, posts] = await Promise.all([getModelStageCounts(modelId), listModelPosts(modelId)]);

  return (
    <div style={{ width: "100%", maxWidth: 880, padding: "34px 20px" }}>
      <div className="bc-topbar" style={{ marginBottom: 20 }}>
        <h2>{model.name}</h2>
        <form action={logoutPortal}>
          <button
            type="submit"
            style={{
              background: "var(--bc-surface)",
              color: "var(--bc-text-dim)",
              border: "1px solid var(--bc-border)",
              fontWeight: 600,
              fontSize: 12.5,
              padding: "8px 14px",
              borderRadius: 9,
              cursor: "pointer",
            }}
          >
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Pipeline</span>Avancement du contenu
        </div>
      </div>
      <div className="bc-grid4" style={{ marginBottom: 22 }}>
        {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map((stage) => (
          <div key={stage} className="bc-card" style={{ padding: 16 }}>
            <div style={{ fontFamily: "var(--font-jbmono)", fontSize: 10, letterSpacing: 1, color: "var(--bc-text-faint)", textTransform: "uppercase" }}>
              {STAGE_LABELS[stage]}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--bc-text)", marginTop: 6 }}>{stageCounts[stage]}</div>
          </div>
        ))}
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Publications</span>Vos publications
        </div>
      </div>
      <div className="bc-card">
        {posts.length === 0 && (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucune publication pour le moment.</p>
        )}
        {posts.map((p) => (
          <div key={p.id} className="bc-watch-row">
            <div className="bc-watch-left">
              <div className="bc-watch-icon">{p.platform.slice(0, 2)}</div>
              <div>
                <div className="bc-watch-name">{p.videoTitle}</div>
                <div className="bc-watch-sub">
                  {p.platform} · {new Date(p.scheduledTime).toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
            <div className="bc-watch-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`bc-cc-status ${POST_STATUS_CLASS[p.status]}`}>{POST_STATUS_LABEL[p.status] ?? p.status}</span>
              {p.publicUrl && (
                <a href={p.publicUrl} target="_blank" rel="noreferrer" style={{ color: "var(--bc-amber)", fontSize: 12 }}>
                  Voir →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
