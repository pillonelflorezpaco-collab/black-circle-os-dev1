import { listClientsForGrid } from "@/services/client.service";

const STATUS_LABEL: Record<string, string> = { OK: "Sain", WARN: "Attention", CRIT: "Critique" };
const STATUS_CLASS: Record<string, string> = { OK: "ok", WARN: "warn", CRIT: "crit" };

export default async function ClientsPage() {
  const clients = await listClientsForGrid();

  return (
    <>
      <div className="bc-topbar">
        <h2>Clients</h2>
        <div className="bc-status">
          <span className="dot" />
          {clients.length} clients actifs
        </div>
      </div>

      <div className="bc-client-grid">
        {clients.map((c) => (
          <div key={c.id} className="bc-client-card">
            <div className="bc-cc-top">
              <div className="bc-cc-avatar">{c.initials}</div>
              <div>
                <div className="bc-cc-name">{c.name}</div>
                <div className="bc-cc-team">{c.teamName}</div>
              </div>
              <div className="bc-cc-plats">
                {c.platformCodes.slice(0, 3).map((code, i) => (
                  <span key={i}>{code}</span>
                ))}
              </div>
            </div>
            <div className="bc-cc-stats">
              <div className="bc-cc-stat">
                <div className="lab">Vidéos dispo.</div>
                <div className="val">{c.videoCount}</div>
              </div>
              <div className="bc-cc-stat">
                <div className="lab">Jours restants</div>
                <div
                  className="val"
                  style={{
                    color:
                      c.status === "CRIT" ? "var(--bc-red)" : c.status === "WARN" ? "var(--bc-amber)" : "var(--bc-green)",
                  }}
                >
                  {c.daysRemaining.toFixed(1).replace(".", ",")}
                </div>
              </div>
            </div>
            <div className="bc-cc-footer">
              <span className={`bc-cc-status ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 10, color: "var(--bc-text-faint)" }}>Voir →</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
