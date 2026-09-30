import { ApprovalActions } from "@/components/blackos/CommandCenter/ApprovalActions";
import {
  SOCIAL_MEDIA_STATE_LABEL,
  APPROVAL_STATE_LABEL,
  EXECUTION_STATE_LABEL,
  type SocialMediaPostDetailData,
} from "@/services/socialMedia.service";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function hasExtension(url: string, extensions: string[]): boolean {
  const clean = url.split("?")[0].toLowerCase();
  return extensions.some((ext) => clean.endsWith(ext));
}

/**
 * A Drive share link (e.g. ".../file/d/ID/view") is an HTML page, not raw
 * media bytes — it must never be assumed playable/renderable just because
 * it's non-empty. Only a URL whose path genuinely ends in a known media
 * extension is treated as directly usable; anything else (including an
 * unrecognized driveUrl) falls back to thumbnailUrl, then to the honest
 * "Preview unavailable" state — never a broken <video>/<img>.
 */
function MediaPreview({ driveUrl, thumbnailUrl, title }: { driveUrl: string | null; thumbnailUrl: string | null; title: string }) {
  if (driveUrl && hasExtension(driveUrl, VIDEO_EXTENSIONS)) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video controls poster={thumbnailUrl ?? undefined} style={{ width: "100%", maxHeight: 320, borderRadius: 10, background: "#000" }}>
        <source src={driveUrl} />
      </video>
    );
  }
  const imageSrc = driveUrl && hasExtension(driveUrl, IMAGE_EXTENSIONS) ? driveUrl : thumbnailUrl;
  if (imageSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageSrc} alt={title} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 10 }} />;
  }
  return (
    <div style={{ padding: "34px 0", textAlign: "center", color: "var(--bc-text-faint)", fontStyle: "italic", background: "var(--bc-surface-2)", borderRadius: 10, fontSize: 12.5 }}>
      Preview unavailable
    </div>
  );
}

const STATE_PILL_CLASS: Record<string, string> = {
  DRAFT: "",
  SCHEDULED: "",
  AWAITING_APPROVAL: "pending",
  READY: "ok",
  EXECUTING: "pending",
  SUCCEEDED: "ok",
  FAILED: "crit",
};

export function SocialMediaPostDetail({ detail, canDecide }: { detail: SocialMediaPostDetailData; canDecide: boolean }) {
  const accountLabel = detail.account.displayName || detail.account.blotatoAccountRef || detail.account.platformConnection?.externalAccountId || "—";
  const approvalLabel = detail.approval ? (APPROVAL_STATE_LABEL[detail.approval.status] ?? detail.approval.status) : "Not required";
  const executionLabel = detail.execution ? (EXECUTION_STATE_LABEL[detail.execution.status] ?? detail.execution.status) : "Not created";

  return (
    <div className="bc-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="bc-watch-name" style={{ fontSize: 15 }}>
            {detail.model.name} <span style={{ color: "var(--bc-text-faint)", fontWeight: 400 }}>— {detail.platform} · @{accountLabel}</span>
          </div>
          <div className="bc-watch-sub">{new Date(detail.scheduledTime).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
        <span className={`bc-status-pill ${STATE_PILL_CLASS[detail.state]}`}>{SOCIAL_MEDIA_STATE_LABEL[detail.state]}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }}>
        <div>
          <MediaPreview driveUrl={detail.video.driveUrl} thumbnailUrl={detail.video.thumbnailUrl} title={detail.video.title} />
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--bc-text-dim)" }}>{detail.video.caption ?? <span style={{ fontStyle: "italic", color: "var(--bc-text-faint)" }}>No caption.</span>}</div>
          {detail.video.driveUrl && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--bc-text-faint)" }}>
              Source: Drive ·{" "}
              <a href={detail.video.driveUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--bc-amber)" }}>
                {detail.video.title}
              </a>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}>
          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Approval</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`bc-status-pill ${detail.approval?.status === "PENDING" ? "pending" : detail.approval?.status === "APPROVED" ? "ok" : detail.approval?.status === "REJECTED" ? "crit" : ""}`}>{approvalLabel}</span>
              {detail.approval?.status === "PENDING" && (canDecide ? <ApprovalActions approvalId={detail.approval.id} /> : null)}
            </div>
          </div>

          <div>
            <div style={{ color: "var(--bc-text-faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Execution</div>
            <span className={`bc-status-pill ${detail.execution?.status === "SUCCEEDED" ? "ok" : detail.execution?.status === "FAILED" ? "crit" : detail.execution ? "pending" : ""}`}>{executionLabel}</span>
            {detail.execution?.failureReason && <div style={{ marginTop: 6, fontSize: 11, color: "var(--bc-red)" }}>{detail.execution.failureReason}</div>}
          </div>

          <div style={{ borderTop: "1px solid var(--bc-border)", paddingTop: 12, marginTop: 4 }}>
            <div style={{ color: "var(--bc-amber)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Blotato Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 5, columnGap: 10, fontSize: 12 }}>
              <span style={{ color: "var(--bc-text-faint)" }}>Account</span>
              <span>@{accountLabel}</span>
              <span style={{ color: "var(--bc-text-faint)" }}>Platform</span>
              <span>{detail.platform}</span>
              <span style={{ color: "var(--bc-text-faint)" }}>Caption</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail.video.caption ?? "—"}</span>
              <span style={{ color: "var(--bc-text-faint)" }}>Scheduled</span>
              <span>{new Date(detail.scheduledTime).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span style={{ color: "var(--bc-text-faint)" }}>Status</span>
              <span>{SOCIAL_MEDIA_STATE_LABEL[detail.state]}</span>
              <span style={{ color: "var(--bc-text-faint)" }}>Execution</span>
              <span style={{ color: "var(--bc-amber)" }}>DRY RUN — real publishing disabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
