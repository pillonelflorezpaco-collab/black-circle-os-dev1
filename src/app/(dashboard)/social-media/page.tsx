import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getSocialMediaOverview, getPostDetail, SOCIAL_MEDIA_STATE_LABEL, type SocialMediaPostState } from "@/services/socialMedia.service";
import { PLATFORM_COLOR } from "@/services/post.service";
import { SystemOverview } from "@/components/blackos/CommandCenter/SystemOverview";
import { SocialMediaPostRow } from "@/components/blackos/SocialMedia/SocialMediaPostRow";
import { SocialMediaPostDetail } from "@/components/blackos/SocialMedia/SocialMediaPostDetail";
import { SocialMediaTabs } from "@/components/blackos/SocialMedia/SocialMediaTabs";
import type { Platform } from "@prisma/client";

const PLATFORMS: Platform[] = ["INSTAGRAM", "YOUTUBE", "FACEBOOK", "PINTEREST", "THREADS", "TWITTER", "LINKEDIN", "TIKTOK", "BLUESKY"];
const STATES: SocialMediaPostState[] = ["DRAFT", "SCHEDULED", "AWAITING_APPROVAL", "READY", "EXECUTING", "SUCCEEDED", "FAILED"];

export default async function SocialMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; platform?: string; state?: string; postId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canDecide = !!session?.user && can(session.user.role, "approuverTaches");
  const agencyId = await getEffectiveAgencyId();

  const platform = PLATFORMS.includes(params.platform as Platform) ? (params.platform as Platform) : undefined;
  const state = STATES.includes(params.state as SocialMediaPostState) ? (params.state as SocialMediaPostState) : undefined;

  const [{ summary, models, posts }, detail] = await Promise.all([
    getSocialMediaOverview(agencyId, { modelId: params.model || undefined, platform, state }),
    params.postId ? getPostDetail(params.postId, agencyId) : Promise.resolve(null),
  ]);

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

      <SocialMediaTabs active="overview" />

      {detail && <SocialMediaPostDetail detail={detail} canDecide={canDecide} />}

      <SystemOverview
        cards={[
          { label: "Models", value: summary.modelCount, sub: "with social accounts" },
          { label: "Connected Accounts", value: summary.connectedAccountCount, sub: "active" },
          { label: "Scheduled", value: summary.scheduledCount, sub: "posts scheduled" },
          { label: "Awaiting Approval", value: summary.awaitingApprovalCount, sub: "needs a decision", tone: summary.awaitingApprovalCount > 0 ? "amber" : "neutral" },
          { label: "Ready", value: summary.readyCount, sub: "approved, not yet run" },
          { label: "Failed", value: summary.failedCount, sub: "needs attention", tone: summary.failedCount > 0 ? "amber" : "neutral" },
        ]}
      />

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Models</span>Models &amp; connected accounts
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 24 }}>
        {models.length === 0 ? (
          <p className="bc-empty-state">No models with social accounts yet.</p>
        ) : (
          models.map((model) => (
            <div key={model.id} className="bc-watch-row">
              <div className="bc-watch-left">
                <div className="bc-watch-icon">{model.name[0]?.toUpperCase() ?? "?"}</div>
                <div>
                  <div className="bc-watch-name">{model.name}</div>
                  <div className="bc-watch-sub" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {model.platforms.map((p, i) => (
                      <span key={i} className="bc-plat-chip" style={{ padding: "2px 8px", fontSize: 10.5 }}>
                        <span className="pc-dot" style={{ background: PLATFORM_COLOR[p.platform] ?? "#8C8A85" }} />
                        {p.platform}
                        {!p.isActive && <span style={{ color: "var(--bc-red)" }}> · inactif</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bc-watch-right" style={{ textAlign: "right", fontSize: 11, color: "var(--bc-text-faint)" }}>
                <div>{model.pendingPostCount} pending</div>
                <div>{model.scheduledPostCount} scheduled</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Filters</span>Posts
        </div>
      </div>
      <form method="get" className="bc-card" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <select name="model" defaultValue={params.model ?? ""} className="bc-jarvis-input" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select name="platform" defaultValue={params.platform ?? ""} className="bc-jarvis-input" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}>
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select name="state" defaultValue={params.state ?? ""} className="bc-jarvis-input" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}>
          <option value="">All statuses</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {SOCIAL_MEDIA_STATE_LABEL[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="bc-jarvis-plan-btn" style={{ padding: "6px 14px" }}>
          Apply
        </button>
        {(params.model || params.platform || params.state) && (
          <a href="/social-media" style={{ fontSize: 11.5, color: "var(--bc-text-faint)", textDecoration: "underline" }}>
            Clear filters
          </a>
        )}
      </form>

      <div className="bc-card">
        {posts.length === 0 ? (
          <p className="bc-empty-state">No posts match the current filters.</p>
        ) : (
          posts.map((post) => (
            <SocialMediaPostRow
              key={post.id}
              canDecide={canDecide}
              post={{
                id: post.id,
                modelName: post.modelName,
                platform: post.platform,
                caption: post.caption,
                thumbnailUrl: post.thumbnailUrl,
                scheduledLabel: new Date(post.scheduledTime).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }),
                stateLabel: SOCIAL_MEDIA_STATE_LABEL[post.state],
                state: post.state,
                taskId: post.taskId,
                approvalId: post.approvalId,
                approvalStatus: post.approvalStatus,
                executionStatus: post.executionStatus,
              }}
            />
          ))
        )}
      </div>
    </>
  );
}
