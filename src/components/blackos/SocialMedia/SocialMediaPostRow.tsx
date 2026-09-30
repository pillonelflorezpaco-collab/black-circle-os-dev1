"use client";

import { useState } from "react";
import { ApprovalActions } from "@/components/blackos/CommandCenter/ApprovalActions";
import type { SocialMediaPostState } from "@/services/socialMedia.service";

const STATE_PILL_CLASS: Record<SocialMediaPostState, string> = {
  DRAFT: "",
  SCHEDULED: "",
  AWAITING_APPROVAL: "pending",
  READY: "ok",
  EXECUTING: "pending",
  SUCCEEDED: "ok",
  FAILED: "crit",
};

export interface SocialMediaPostRowData {
  id: string;
  modelName: string;
  platform: string;
  caption: string | null;
  thumbnailUrl: string | null;
  scheduledLabel: string;
  stateLabel: string;
  state: SocialMediaPostState;
  taskId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  executionStatus: string | null;
}

/**
 * Row-level disclosure only — no route change, no new detail page. Reuses
 * ApprovalActions exactly as Command Center's ApprovalPanel does: rendered
 * only when this post's own Approval is PENDING and the caller already has
 * canDecide (computed server-side from the real session, same as
 * approvals/page.tsx). No client-controlled bypass of that check exists here
 * — canDecide is a prop derived upstream, never read from anything the user
 * can influence.
 */
export function SocialMediaPostRow({ post, canDecide }: { post: SocialMediaPostRowData; canDecide: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bc-watch-row" style={{ flexDirection: "column", alignItems: "stretch", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div className={`bc-watch-icon ${post.state === "FAILED" ? "dot-crit" : post.state === "AWAITING_APPROVAL" ? "dot-warn" : post.state === "SUCCEEDED" || post.state === "READY" ? "dot-ok" : ""}`}>•</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="bc-watch-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {post.modelName} <span style={{ color: "var(--bc-text-faint)", fontWeight: 400 }}>— {post.platform}</span>
            </div>
            <div className="bc-watch-sub">{post.scheduledLabel}</div>
          </div>
        </div>
        <div className="bc-watch-right">
          <span className={`bc-status-pill ${STATE_PILL_CLASS[post.state]}`}>{post.stateLabel}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--bc-border)", fontSize: 12, color: "var(--bc-text-dim)" }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "var(--bc-text-faint)" }}>Caption: </span>
            {post.caption ?? <span style={{ fontStyle: "italic" }}>—</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, color: "var(--bc-text-faint)" }}>
            <span>Task: {post.taskId ?? "—"}</span>
            <span>Approval: {post.approvalStatus ?? "—"}</span>
            <span>Execution: {post.executionStatus ?? "—"}</span>
            <a href={`/social-media?postId=${post.id}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--bc-amber)" }}>
              View full detail →
            </a>
          </div>

          {post.state === "AWAITING_APPROVAL" && post.approvalId && (
            <div style={{ marginTop: 10 }}>{canDecide ? <ApprovalActions approvalId={post.approvalId} /> : <span className="bc-status-pill pending">EN ATTENTE</span>}</div>
          )}
        </div>
      )}
    </div>
  );
}
