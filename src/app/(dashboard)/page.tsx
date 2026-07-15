import { getDashboardData } from "@/services/dashboard.service";
import { getViewsByAccount } from "@/services/analytics.service";
import { PLATFORM_COLOR } from "@/services/post.service";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { RingGauge } from "@/components/shared/RingGauge";
import { PeriodToggle } from "@/components/shared/PeriodToggle";
import { getSelectedClientId } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatCompactNumber } from "@/lib/utils";
import type { Period, DateRange } from "@/lib/dates";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  custom: "période choisie",
};

function severityIcon(severity: "OK" | "WARN" | "CRIT") {
  if (severity === "OK") return "dot-ok";
  if (severity === "WARN") return "dot-warn";
  return "dot-crit";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = (["today", "week", "month", "year", "custom"].includes(params.period ?? "")
    ? params.period
    : "month") as Period;

  let customRange: DateRange | undefined;
  if (period === "custom" && params.from && params.to) {
    const start = new Date(`${params.from}T00:00:00`);
    const end = new Date(`${params.to}T23:59:59.999`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) customRange = { start, end };
  }

  const selectedClientId = await getSelectedClientId();
  const selectedClient = selectedClientId
    ? await prisma.client.findUnique({ where: { id: selectedClientId }, select: { name: true } })
    : null;

  const [data, viewsByAccount] = await Promise.all([
    getDashboardData(period, selectedClientId, customRange),
    getViewsByAccount(selectedClientId),
  ]);
  const maxViews = viewsByAccount.length > 0 ? viewsByAccount[0].views : 0;

  return (
    <>
      <div className="bc-topbar">
        <h2>
          Bonjour, <span className="accent">Angels</span>
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Tous les systèmes opérationnels
        </div>
      </div>

      <div className="bc-hero-glow">
        <div className="top-row">
          <div className="lab">
            Vue d&apos;ensemble — Production {selectedClient ? `— ${selectedClient.name}` : ""}
          </div>
          <PeriodToggle period={period} from={params.from} to={params.to} />
        </div>

        <div className="bc-hero-split">
          <div>
            <div className="amt-row">
              <div className="amt">{data.heroAmount}</div>
              <div className="pill">{data.heroDeltaLabel}</div>
            </div>
            <div className="sub">Vidéos publiées</div>
          </div>
          <div className="bc-stat-badges">
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-amber">P</div>
              <div>
                <div className="bc-sb-val">{data.tiles.publishedThisPeriod}</div>
                <div className="bc-sb-lab">Publications</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-blue">E</div>
              <div>
                <div className="bc-sb-val">{data.tiles.editingCount}</div>
                <div className="bc-sb-lab">En édition</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-green">S</div>
              <div>
                <div className="bc-sb-val">{data.tiles.scheduledCount}</div>
                <div className="bc-sb-lab">Programmées</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-rose">!</div>
              <div>
                <div className="bc-sb-val">{data.tiles.errorCount}</div>
                <div className="bc-sb-lab">Erreurs</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-amber">C</div>
              <div>
                <div className="bc-sb-val">{data.tiles.activeClients}</div>
                <div className="bc-sb-lab">Clients actifs</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-green">R</div>
              <div>
                <div className="bc-sb-val">{data.tiles.reviewCount}</div>
                <div className="bc-sb-lab">À valider</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mini-chart-wrap">
          <Sparkline data={data.trend} />
        </div>
      </div>

      <div className="bc-grid4">
        <div className="bc-mini-card">
          <div className="lab">Clients actifs</div>
          <div className="val amber">{data.tiles.activeClients}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Publications ({PERIOD_LABELS[period].toLowerCase()})</div>
          <div className="val">{data.tiles.publishedThisPeriod}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Programmées</div>
          <div className="val amber">{data.tiles.scheduledCount}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Vidéos en édition</div>
          <div className="val">{data.tiles.editingCount}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">À valider</div>
          <div className="val amber">{data.tiles.reviewCount}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Erreurs</div>
          <div className="val neg">{data.tiles.errorCount}</div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Contenu restant (moy.)</div>
          <div className="val neg">
            {data.tiles.avgContentRemainingDays}
            <span className="unit">jours</span>
          </div>
        </div>
        <div className="bc-mini-card">
          <div className="lab">Vidéos publiées ({PERIOD_LABELS[period].toLowerCase()})</div>
          <div className="val pos">{data.tiles.publishedThisPeriod}</div>
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Temps réel</span>Activité récente
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        {data.activity.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucune activité pour le moment.</p>
        ) : (
          data.activity.map((entry) => (
            <div key={entry.id} className="bc-watch-row">
              <div className="bc-watch-left">
                <div className={`bc-watch-icon ${severityIcon(entry.severity)}`}>•</div>
                <div>
                  <div className="bc-watch-name">{entry.message}</div>
                  {entry.client && <div className="bc-watch-sub">{entry.client.name}</div>}
                </div>
              </div>
              <div className="bc-watch-right">
                <div className="bc-watch-amt">{new Date(entry.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Stock</span>Contenu restant par client
        </div>
      </div>
      <div className="bc-card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {data.contentRemaining.map((c) => (
            <RingGauge key={c.id} value={c.days} target={14} label={c.name} />
          ))}
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Performance</span>Vues par compte
        </div>
      </div>
      <div className="bc-card">
        {viewsByAccount.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Pas encore de données de vues.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {viewsByAccount.map((a) => {
              const color = PLATFORM_COLOR[a.platform] ?? "#8C8A85";
              const pct = maxViews > 0 ? Math.max(4, Math.round((a.views / maxViews) * 100)) : 0;
              return (
                <div key={a.accountId}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                      {a.label}
                      <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 9.5, color: "var(--bc-text-faint)", textTransform: "uppercase" }}>
                        {a.platform}
                      </span>
                    </span>
                    <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 13, color: "var(--bc-text)" }}>
                      {formatCompactNumber(a.views)} <span style={{ color: "var(--bc-text-faint)", fontSize: 10 }}>vues</span>
                    </span>
                  </div>
                  <div className="bc-tc-bar-track">
                    <div className="bc-tc-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
