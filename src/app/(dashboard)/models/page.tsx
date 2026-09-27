import Link from "next/link";
import { listModelsForGrid } from "@/services/model.service";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import AccessCodeControl from "./AccessCodeControl";

const STATUS_LABEL: Record<string, string> = { OK: "Sain", WARN: "Attention", CRIT: "Critique" };
const STATUS_CLASS: Record<string, string> = { OK: "ok", WARN: "warn", CRIT: "crit" };

export default async function ModelsPage() {
  const agencyId = await getEffectiveAgencyId();
  const [models, session] = await Promise.all([listModelsForGrid(agencyId), auth()]);
  const canManage = !!session?.user && can(session.user.role, "gererEquipe");

  return (
    <>
      <div className="bc-topbar">
        <h2>Models</h2>
        <div className="bc-status">
          <span className="dot" />
          {models.length} models actifs
        </div>
      </div>

      <div className="bc-client-grid">
        {models.map((m) => (
          <Link key={m.id} href={`/models/${m.id}`} className="bc-client-card">
            <div className="bc-cc-top">
              <div className="bc-cc-avatar">{m.initials}</div>
              <div>
                <div className="bc-cc-name">{m.name}</div>
                <div className="bc-cc-team">{m.teamName}</div>
              </div>
              <div className="bc-cc-plats">
                {m.platformCodes.slice(0, 3).map((code, i) => (
                  <span key={i}>{code}</span>
                ))}
              </div>
            </div>
            <div className="bc-cc-stats">
              <div className="bc-cc-stat">
                <div className="lab">Vidéos dispo.</div>
                <div className="val">{m.videoCount}</div>
              </div>
              <div className="bc-cc-stat">
                <div className="lab">Jours restants</div>
                <div
                  className="val"
                  style={{
                    color:
                      m.status === "CRIT" ? "var(--bc-red)" : m.status === "WARN" ? "var(--bc-amber)" : "var(--bc-green)",
                  }}
                >
                  {m.daysRemaining.toFixed(1).replace(".", ",")}
                </div>
              </div>
            </div>
            <div className="bc-cc-footer">
              <span className={`bc-cc-status ${STATUS_CLASS[m.status]}`}>{STATUS_LABEL[m.status]}</span>
              <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 10, color: "var(--bc-text-faint)" }}>Voir →</span>
            </div>
            {canManage && <AccessCodeControl modelId={m.id} accessCode={m.accessCode} />}
          </Link>
        ))}
      </div>
    </>
  );
}
