import { listReports } from "@/services/report.service";

export default async function RapportsPage() {
  const reports = await listReports();

  return (
    <>
      <div className="bc-topbar">
        <h2>Rapports</h2>
      </div>

      <div className="bc-hero-glow" style={{ padding: "26px 30px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="lab">Génération</div>
            <div style={{ fontFamily: "var(--font-fraunces)", fontSize: 19, color: "#F2EFE8" }}>Créer un nouveau rapport</div>
          </div>
          <button
            type="button"
            style={{
              background: "var(--bc-amber)",
              color: "#1A1409",
              border: "none",
              fontWeight: 600,
              fontSize: 12.5,
              padding: "9px 16px",
              borderRadius: 9,
              cursor: "not-allowed",
              opacity: 0.6,
            }}
            title="Génération de rapports — à implémenter (choix librairie PDF/CSV en attente)"
          >
            + Générer
          </button>
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Historique</span>Rapports générés
        </div>
      </div>
      <div className="bc-card">
        {reports.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucun rapport généré pour le moment.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="bc-report-row">
              <div className="bc-report-icon">
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M5 1.8h5.4L14 5.4v9.4H5z" />
                  <path d="M10.3 1.8v3.6H14M7 10h4M7 12.6h4" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="bc-watch-name">{r.name}</div>
                <div className="bc-watch-sub">
                  {r.format} · {r.sizeBytes ? `${Math.round(r.sizeBytes / 1024)} Ko` : "—"}
                </div>
              </div>
              <div className="bc-watch-right">
                <div className="bc-watch-amt">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
