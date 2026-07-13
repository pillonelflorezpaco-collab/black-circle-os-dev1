import { getCalendarMonth } from "@/services/post.service";

const DOW = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default async function PublicationsPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const byDay = await getCalendarMonth(year, month);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const leadingBlanks = (firstDow + 6) % 7; // convert to Mon-first offset
  const today = now.getUTCDate();

  return (
    <>
      <div className="bc-topbar">
        <h2>Publications</h2>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          Calendrier de publication
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
              <div key={day} className={`bc-cal-cell${day === today ? " today" : ""}`}>
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
