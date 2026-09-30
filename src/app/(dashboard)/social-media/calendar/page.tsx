import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getSocialMediaCalendar, getPostDetail, SOCIAL_MEDIA_STATE_LABEL, type SocialMediaPostState } from "@/services/socialMedia.service";
import { PLATFORM_COLOR } from "@/services/post.service";
import { SocialMediaTabs } from "@/components/blackos/SocialMedia/SocialMediaTabs";
import { SocialMediaPostDetail } from "@/components/blackos/SocialMedia/SocialMediaPostDetail";
import { can } from "@/lib/permissions";
import type { Platform } from "@prisma/client";

const DOW = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const PLATFORMS: Platform[] = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "PINTEREST", "THREADS", "TWITTER", "LINKEDIN", "TIKTOK", "BLUESKY"];

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default async function SocialMediaCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; platform?: string; postId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canDecide = !!session?.user && can(session.user.role, "approuverTaches");
  const agencyId = await getEffectiveAgencyId();

  const now = new Date();
  const year = Number(params.year) || now.getUTCFullYear();
  const month = Number(params.month) || now.getUTCMonth() + 1;
  const platform = PLATFORMS.includes(params.platform as Platform) ? (params.platform as Platform) : undefined;

  const [calendarPosts, detail] = await Promise.all([
    getSocialMediaCalendar(agencyId, year, month, { platform }),
    params.postId ? getPostDetail(params.postId, agencyId) : Promise.resolve(null),
  ]);

  const byDay = new Map<number, typeof calendarPosts>();
  for (const post of calendarPosts) {
    const list = byDay.get(post.day) ?? [];
    list.push(post);
    byDay.set(post.day, list);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlanks = (firstDow + 6) % 7;
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
  const today = now.getUTCDate();
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const stateDot: Record<SocialMediaPostState, string> = {
    DRAFT: "#8C8A85",
    SCHEDULED: "#7FA3C4",
    AWAITING_APPROVAL: "#E8B368",
    READY: "#7FAE86",
    EXECUTING: "#E8B368",
    SUCCEEDED: "#7FAE86",
    FAILED: "#C1604A",
  };

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Social</span> Media
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Dry-run execution only
        </div>
      </div>

      <SocialMediaTabs active="calendar" />

      {detail && <SocialMediaPostDetail detail={detail} canDecide={canDecide} />}

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          Social media calendar
        </div>
        <div className="bc-time-toggle" style={{ background: "var(--bc-surface-2)" }}>
          <Link href={`/social-media/calendar?year=${prev.year}&month=${prev.month}${platform ? `&platform=${platform}` : ""}`}>← Précédent</Link>
          <Link href={`/social-media/calendar?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}${platform ? `&platform=${platform}` : ""}`}>Aujourd&apos;hui</Link>
          <Link href={`/social-media/calendar?year=${next.year}&month=${next.month}${platform ? `&platform=${platform}` : ""}`}>Suivant →</Link>
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
            const dayPosts = byDay.get(day) ?? [];
            const visible = dayPosts.slice(0, 3);
            return (
              <div key={day} className={`bc-cal-cell${isCurrentMonth && day === today ? " today" : ""}`}>
                <span className="bc-cal-date">{day}</span>
                {visible.map((p) => (
                  <Link
                    key={p.id}
                    href={`/social-media?postId=${p.id}`}
                    className="bc-cal-chip"
                    style={{ background: PLATFORM_COLOR[p.platform] ?? "#8C8A85", textDecoration: "none", position: "relative" }}
                    title={`${p.modelName} — ${p.platform} — ${SOCIAL_MEDIA_STATE_LABEL[p.state]}`}
                  >
                    {p.platform.slice(0, 2)}
                    <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: stateDot[p.state], border: "1px solid var(--bc-surface)" }} />
                  </Link>
                ))}
                {dayPosts.length > 3 && <span className="bc-cal-more">+{dayPosts.length - 3}</span>}
              </div>
            );
          })}
        </div>

        {byDay.size === 0 && <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", marginTop: 14 }}>Aucune publication programmée ce mois-ci.</p>}
      </div>
    </>
  );
}
