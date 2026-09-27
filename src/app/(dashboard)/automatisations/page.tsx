import { listIntegrations } from "@/services/integration.service";
import { getEffectiveAgencyId } from "@/lib/agencyContext";

const ICONS: Record<string, string> = {
  drive: '<path d="M4.5 2h5l3.5 6-1.75 3H3.25L1.5 8Z"/>',
  calendar: '<rect x="2" y="3" width="14" height="12" rx="1.6"/><path d="M2 6.6h14M6 2v2.6M12 2v2.6"/>',
  flow: '<circle cx="3" cy="3.5" r="1.6"/><circle cx="11" cy="3.5" r="1.6"/><circle cx="7" cy="10.5" r="1.6"/><path d="M4.4 4.6 6 9M9.6 4.6 8 9"/>',
  send: '<path d="M12.4 1.6 1.6 6l4 1.8L7.4 12l1.6-3.4 3.4-7Z" stroke-linejoin="round"/>',
  bell: '<path d="M4 6.4a4 4 0 0 1 8 0c0 3.6 1.2 4.6 1.2 4.6H2.8S4 10 4 6.4Z"/><path d="M6.6 13.2a1.5 1.5 0 0 0 2.8 0"/>',
  sheet: '<rect x="2" y="1.8" width="10" height="10.4" rx="1.2"/><path d="M2 5h10M5.3 5v7.2M8.7 5v7.2"/>',
  api: '<path d="M9.6 2 3.5 10.2h4L7.4 16l7-9h-4.3z" stroke-linejoin="round"/>',
};

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Connecté",
  DISCONNECTED: "Non connecté",
  COMING_SOON: "Bientôt",
};

export default async function AutomatisationsPage() {
  const agencyId = await getEffectiveAgencyId();
  const integrations = agencyId ? await listIntegrations(agencyId) : [];

  return (
    <>
      <div className="bc-topbar">
        <h2>Automatisations</h2>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Actives & à venir</span>Intégrations
        </div>
      </div>

      <div className="bc-grid4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {integrations.map((i) => (
          <div
            key={i.id}
            style={{
              background: "var(--bc-surface)",
              border: "1px solid var(--bc-border)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              alignItems: "flex-start",
              gap: 13,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "var(--bc-surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--bc-amber)",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: ICONS[i.icon] ?? ICONS.api }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{i.label}</div>
              <div style={{ fontSize: 11, color: "var(--bc-text-faint)", marginTop: 2 }}>{i.description}</div>
              {i.lastError && (
                <div style={{ fontSize: 10.5, color: "var(--bc-red)", marginTop: 6, fontFamily: "var(--font-jbmono)" }}>
                  {i.lastError}
                </div>
              )}
              {i.lastSyncAt && (
                <div style={{ fontSize: 10, color: "var(--bc-text-faint)", marginTop: 4, fontFamily: "var(--font-jbmono)" }}>
                  Dernière synchro : {new Date(i.lastSyncAt).toLocaleString("fr-FR")}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-jbmono)",
                padding: "4px 10px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                flexShrink: 0,
                background:
                  i.status === "CONNECTED"
                    ? "rgba(127,174,134,.14)"
                    : i.status === "COMING_SOON"
                      ? "rgba(232,179,104,.1)"
                      : "var(--bc-surface-2)",
                color:
                  i.status === "CONNECTED"
                    ? "var(--bc-green)"
                    : i.status === "COMING_SOON"
                      ? "var(--bc-amber-dim)"
                      : "var(--bc-text-faint)",
              }}
            >
              {STATUS_LABEL[i.status]}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
