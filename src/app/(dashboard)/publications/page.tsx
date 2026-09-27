import Link from "next/link";
import { getCalendarMonth } from "@/services/post.service";
import { getSelectedModelId } from "@/app/actions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { prisma } from "@/lib/prisma";

const DOW = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;

  const [selectedModelId, agencyId] = await Promise.all([getSelectedModelId(), getEffectiveAgencyId()]);
  const selectedModel = selectedModelId
    ? await prisma.model.findUnique({ where: { id: selectedModelId }, select: { name: true } })
    : null;

  const byDay = await getCalendarMonth(year, month, agencyId, selectedModelId);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const leadingBlanks = (firstDow + 6) % 7; // convert to Mon-first offset
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
  const today = now.getUTCDate();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <div className="bc-topbar">
        <h2>
          Publications {selectedModel ? <span className="accent">— {selectedModel.name}</span> : null}
        </h2>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          Calendrier de publication
        </div>
        <div className="bc-time-toggle" style={{ background: "var(--bc-surface-2)" }}>
          <Link href={`/publications?year=${prev.year}&month=${prev.month}`}>← Précédent</Link>
          <Link href={`/publications?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`}>Aujourd&apos;hui</Link>
          <Link href={`/publications?year=${next.year}&month=${next.month}`}>Suivant →</Link>
        </div>
      </div>

      <div className="bc-card">
        <div className="bc-cal-grid">
          {DOW.map((d) => (
            <div key={d} className="bc-cal-dow">
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const posts = byDay.get(day) ?? [];
            const visible = posts.slice(0, 3);
            return (
              <div key={day} className={`bc-cal-cell${isCurrentMonth && day === today ? " today" : ""}`}>
                <span className="bc-cal-date">{day}</span>
                {visible.map((p, i) => (
                  <span key={i} className="bc-cal-chip" style={{ background: p.color }} title={p.title}>
                    {p.platform.slice(0, 2)}
                  </span>
                ))}
                {posts.length > 3 && <span className="bc-cal-more">+{posts.length - 3}</span>}
              </div>
            );
          })}
        </div>

        {byDay.size === 0 && (
          <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", marginTop: 14 }}>
            Aucune publication programmée ce mois-ci{selectedModel ? ` pour ${selectedModel.name}` : ""}.
          </p>
        )}

        <div className="bc-heatmap-legend">
          {["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK"].map((p) => (
            <span key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="bc-hl-swatch" style={{ background: "#C68F5A" }} />
              {p}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
