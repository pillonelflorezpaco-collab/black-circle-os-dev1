import Link from "next/link";
import { getDashboardData } from "@/services/dashboard.service";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { RingGauge } from "@/components/shared/RingGauge";
import type { Period } from "@/lib/dates";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

function severityIcon(severity: "OK" | "WARN" | "CRIT") {
  if (severity === "OK") return "dot-ok";
  if (severity === "WARN") return "dot-warn";
  return "dot-crit";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (["today", "week", "month", "year"].includes(params.period ?? "")
    ? params.period
    : "month") as Period;

  const data = await getDashboardData(period);

  // 30-point placeholder trend shape while real day-by-day time-series aggregation isn't built yet
  const spark = Array.from({ length: 30 }, (_, i) =>
    Math.round(10 + i * 1.2 + (data.heroAmount / 3) * Math.sin(i / 4))
  );

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
          <div className="lab">Vue d&apos;ensemble — Production</div>
          <div className="bc-time-toggle">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Link key={p} href={`/?period=${p}`} className={p === period ? "active" : ""} scroll={false}>
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
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
          <Sparkline data={spark} />
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
    </>
  );
}
