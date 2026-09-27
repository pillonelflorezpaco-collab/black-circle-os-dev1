import { Fragment } from "react";
import {
  getAnalyticsSummary,
  getTopVideos,
  getPlatformBreakdown,
  getBestHoursHeatmap,
  getDailyViewSeries,
} from "@/services/analytics.service";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { PeriodToggle } from "@/components/shared/PeriodToggle";
import { getSelectedModelId } from "@/app/actions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { prisma } from "@/lib/prisma";
import type { Period, DateRange } from "@/lib/dates";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  custom: "Période choisie",
};

export default async function AnalyticsPage({
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

  const [selectedModelId, agencyId] = await Promise.all([getSelectedModelId(), getEffectiveAgencyId()]);
  const selectedModel = selectedModelId
    ? await prisma.model.findUnique({ where: { id: selectedModelId }, select: { name: true } })
    : null;
  const scopeLabel = selectedModel ? selectedModel.name : "toutes plateformes";

  const [summary, topVideos, platforms, heatmap, dailySeries] = await Promise.all([
    getAnalyticsSummary(period, agencyId, selectedModelId, customRange),
    getTopVideos(period, agencyId, selectedModelId, customRange),
    getPlatformBreakdown(period, agencyId, selectedModelId, customRange),
    getBestHoursHeatmap(period, agencyId, selectedModelId, customRange),
    getDailyViewSeries(30, agencyId, selectedModelId),
  ]);

  const maxHm = Math.max(1, ...heatmap.grid.flat());
  const maxPlat = Math.max(1, ...platforms.map((p) => p.count));
  const spark = dailySeries.map((d) => ({
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: d.views,
  }));

  return (
    <>
      <div className="bc-topbar">
        <h2>
          Analytics <span style={{ fontSize: 15, fontFamily: "var(--font-jbmono)", color: "var(--bc-text-faint)" }}>— {scopeLabel}</span>
        </h2>
      </div>

      <div className="bc-hero-glow">
        <div className="top-row">
          <div className="lab">Performance — {scopeLabel}</div>
          <PeriodToggle period={period} from={params.from} to={params.to} />
        </div>
        <div className="bc-hero-split">
          <div>
            <div className="amt-row">
              <div className="amt">{summary.views.toLocaleString("fr-FR")}</div>
              <div className="pill">{summary.deltaLabel}</div>
            </div>
            <div className="sub">Vues totales</div>
          </div>
          <div className="bc-stat-badges">
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-green">E</div>
              <div>
                <div className="bc-sb-val">{summary.engagementRate}%</div>
                <div className="bc-sb-lab">Engagement</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-rose">L</div>
              <div>
                <div className="bc-sb-val">{summary.likes.toLocaleString("fr-FR")}</div>
                <div className="bc-sb-lab">Likes</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-amber">C</div>
              <div>
                <div className="bc-sb-val">{summary.comments.toLocaleString("fr-FR")}</div>
                <div className="bc-sb-lab">Commentaires</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-green">S</div>
              <div>
                <div className="bc-sb-val">{summary.shares.toLocaleString("fr-FR")}</div>
                <div className="bc-sb-lab">Partages</div>
              </div>
            </div>
            <div className="bc-sb-item">
              <div className="bc-sb-icon c-blue">R</div>
              <div>
                <div className="bc-sb-val">{summary.reach.toLocaleString("fr-FR")}</div>
                <div className="bc-sb-lab">Reach</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mini-chart-wrap">
          <Sparkline data={spark} />
        </div>
      </div>

      <div className="bc-grid2b">
        <div>
          <div className="bc-section-title">
            <div className="st-left">
              <span className="eyebrow">{PERIOD_LABELS[period]}</span>Top vidéos
            </div>
          </div>
          <div className="bc-card">
            {topVideos.length === 0 ? (
              <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Pas encore de métriques.</p>
            ) : (
              topVideos.map((v, i) => (
                <div key={i} className="bc-watch-row">
                  <div className="bc-watch-left">
                    <div className="bc-watch-icon rank">{i + 1}</div>
                    <div>
                      <div className="bc-watch-name">{v.title}</div>
                      <div className="bc-watch-sub">{v.platform}</div>
                    </div>
                  </div>
                  <div className="bc-watch-right">
                    <div className="bc-watch-amt">{v.views.toLocaleString("fr-FR")} vues</div>
                    <div className="bc-watch-pct pos">{v.likes.toLocaleString("fr-FR")} likes</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="bc-section-title">
            <div className="st-left">
              <span className="eyebrow">Réel</span>Meilleures heures
            </div>
          </div>
          <div className="bc-card">
            <div className="bc-heatmap">
              <div />
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} className="bc-hm-day">
                  {d}
                </div>
              ))}
              {heatmap.dayparts.map((slot, r) => (
                <Fragment key={r}>
                  <div className="bc-hm-row-lab">{slot}</div>
                  {heatmap.grid[r].map((v, c) => {
                    const alpha = (0.1 + (v / maxHm) * 0.75).toFixed(2);
                    return <div key={`${r}-${c}`} className="bc-hm-cell" style={{ background: `rgba(232,179,104,${alpha})` }} title={`${v} interactions`} />;
                  })}
                </Fragment>
              ))}
            </div>
            <div className="bc-heatmap-legend">
              <span>Engagement</span>
              <span className="bc-hl-swatch" style={{ background: "rgba(232,179,104,.12)" }} />
              <span className="bc-hl-swatch" style={{ background: "rgba(232,179,104,.4)" }} />
              <span className="bc-hl-swatch" style={{ background: "rgba(232,179,104,.75)" }} />
              <span className="bc-hl-swatch" style={{ background: "#E8B368" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Publiés</span>Répartition par plateforme
        </div>
      </div>
      <div className="bc-card">
        {platforms.length === 0 ? (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic" }}>Aucune publication pour le moment.</p>
        ) : (
          platforms.map((p) => {
            const pct = Math.round((p.count / maxPlat) * 100);
            return (
              <div key={p.platform} className="bc-watch-row">
                <div className="bc-watch-left">
                  <div className="bc-watch-icon">{p.platform.slice(0, 2)}</div>
                  <div>
                    <div className="bc-watch-name">{p.platform}</div>
                    <div className="bc-watch-bar-track">
                      <div className="bc-watch-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="bc-watch-right">
                  <div className="bc-watch-amt">{p.count}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
