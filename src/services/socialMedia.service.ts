import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";

/**
 * Read-only data access for the BlackOS Social Media Command Center
 * (/social-media). Queries the real Post/SocialAccount/Model/Task/Approval/
 * Execution tables directly via Prisma — the same pattern already used by
 * commandCenter.service.ts and post.service.ts. No fake data, no new tables,
 * no new API endpoints: this is a server-component-only aggregation layer.
 *
 * Post.status (PENDING/SCHEDULED/IN_PROGRESS/PUBLISHED/FAILED) and the
 * Task/Approval/Execution lifecycle (via Task.entityType="POST"/entityId)
 * are two currently-independent systems — nothing in the Execution Engine
 * updates Post.status today (confirmed by inspection: no
 * postRepository.updateStatus call exists anywhere in src/execution or
 * src/jarvis). `deriveSocialMediaState` below is the single place that
 * reconciles the two into one deterministic, honest lifecycle label —
 * preferring the Task/Approval/Execution state when a Task exists (since
 * that's the actual source of truth for anything Jarvis-driven), and
 * falling back to Post.status only when no Task references this Post at all.
 */

export type SocialMediaPostState = "DRAFT" | "SCHEDULED" | "AWAITING_APPROVAL" | "READY" | "EXECUTING" | "SUCCEEDED" | "FAILED";

export const SOCIAL_MEDIA_STATE_LABEL: Record<SocialMediaPostState, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  AWAITING_APPROVAL: "Awaiting Approval",
  READY: "Ready",
  EXECUTING: "Executing",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

interface LinkedTask {
  id: string;
  status: string;
  approvals: { id: string; status: string }[];
  executions: { status: string }[];
}

/**
 * Deterministic derivation — never a persisted field, always recomputed from
 * the real rows. Priority: an in-flight/decided Execution or Approval always
 * wins over the raw Post.status, since those reflect what the Task Engine
 * actually did; only a Post with no Task at all falls back to Post.status.
 */
function deriveSocialMediaState(postStatus: string, task: LinkedTask | undefined): SocialMediaPostState {
  if (!task) {
    switch (postStatus) {
      case "PENDING":
        return "DRAFT";
      case "SCHEDULED":
        return "SCHEDULED";
      case "IN_PROGRESS":
        return "EXECUTING";
      case "PUBLISHED":
        return "SUCCEEDED";
      case "FAILED":
        return "FAILED";
      default:
        return "DRAFT";
    }
  }

  const latestExecution = task.executions[0];
  if (latestExecution) {
    if (latestExecution.status === "SUCCEEDED") return "SUCCEEDED";
    if (latestExecution.status === "FAILED" || latestExecution.status === "TIMED_OUT" || latestExecution.status === "CANCELLED") return "FAILED";
    if (latestExecution.status === "RUNNING" || latestExecution.status === "AWAITING_CALLBACK" || latestExecution.status === "PENDING") return "EXECUTING";
  }

  const latestApproval = task.approvals[0];
  if (latestApproval) {
    if (latestApproval.status === "PENDING") return "AWAITING_APPROVAL";
    if (latestApproval.status === "REJECTED") return "FAILED";
  }

  if (task.status === "READY" || task.status === "IN_PROGRESS") return "READY";
  if (task.status === "FAILED" || task.status === "CANCELLED") return "FAILED";
  if (task.status === "COMPLETED") return "SUCCEEDED";

  return "DRAFT";
}

export interface SocialMediaSummary {
  modelCount: number;
  connectedAccountCount: number;
  scheduledCount: number;
  awaitingApprovalCount: number;
  readyCount: number;
  failedCount: number;
}

export interface SocialMediaModelRow {
  id: string;
  name: string;
  logoUrl: string | null;
  platforms: { platform: Platform; isActive: boolean }[];
  pendingPostCount: number;
  scheduledPostCount: number;
}

export interface SocialMediaPostRow {
  id: string;
  modelId: string;
  modelName: string;
  platform: Platform;
  caption: string | null;
  scheduledTime: Date;
  state: SocialMediaPostState;
  taskId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  executionStatus: string | null;
}

export interface SocialMediaFilters {
  modelId?: string;
  platform?: Platform;
  state?: SocialMediaPostState;
}

export interface SocialMediaOverview {
  summary: SocialMediaSummary;
  models: SocialMediaModelRow[];
  posts: SocialMediaPostRow[];
}

/**
 * Single entry point for the /social-media page — one bounded read, no
 * pagination framework (a fixed recent-window `take`, matching the rest of
 * Command Center's read services). `agencyId: null` means cross-agency
 * (Super Admin with no acting agency selected), the same convention used
 * throughout commandCenter.service.ts.
 */
export async function getSocialMediaOverview(agencyId: string | null, filters: SocialMediaFilters = {}, take = 100): Promise<SocialMediaOverview> {
  const agencyScope = agencyId ? { agencyId } : {};

  const posts = await prisma.post.findMany({
    where: {
      ...agencyScope,
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.modelId ? { video: { modelId: filters.modelId } } : {}),
    },
    include: { video: { include: { model: { select: { id: true, name: true, logoUrl: true } } } } },
    orderBy: { scheduledTime: "desc" },
    take,
  });

  const postIds = posts.map((p) => p.id);
  const tasks = postIds.length
    ? await prisma.task.findMany({
        where: { entityType: "POST", entityId: { in: postIds }, ...agencyScope },
        include: {
          approvals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
          executions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // A Post can (rarely) have more than one Task over time (e.g. a retried
  // request) — keep only the most recent per entityId, since tasks is
  // already ordered createdAt desc.
  const taskByPostId = new Map<string, LinkedTask>();
  for (const task of tasks) {
    if (!task.entityId || taskByPostId.has(task.entityId)) continue;
    taskByPostId.set(task.entityId, task);
  }

  let rows: SocialMediaPostRow[] = posts.map((post) => {
    const task = taskByPostId.get(post.id);
    const approval = task?.approvals[0];
    const execution = task?.executions[0];
    return {
      id: post.id,
      modelId: post.video.model.id,
      modelName: post.video.model.name,
      platform: post.platform,
      caption: post.video.caption,
      scheduledTime: post.scheduledTime,
      state: deriveSocialMediaState(post.status, task),
      taskId: task?.id ?? null,
      approvalId: approval?.id ?? null,
      approvalStatus: approval?.status ?? null,
      executionStatus: execution?.status ?? null,
    };
  });

  if (filters.state) {
    rows = rows.filter((r) => r.state === filters.state);
  }

  const modelsWithAccounts = await prisma.model.findMany({
    where: { ...agencyScope, socialAccounts: { some: {} } },
    select: { id: true, name: true, logoUrl: true, socialAccounts: { select: { platform: true, isActive: true } } },
    orderBy: { name: "asc" },
  });

  const models: SocialMediaModelRow[] = modelsWithAccounts.map((model) => {
    const modelPosts = rows.filter((r) => r.modelId === model.id);
    return {
      id: model.id,
      name: model.name,
      logoUrl: model.logoUrl,
      platforms: model.socialAccounts,
      pendingPostCount: modelPosts.filter((r) => r.state === "AWAITING_APPROVAL" || r.state === "DRAFT").length,
      scheduledPostCount: modelPosts.filter((r) => r.state === "SCHEDULED" || r.state === "READY").length,
    };
  });

  const connectedAccountCount = await prisma.socialAccount.count({ where: { isActive: true, model: agencyId ? { agencyId } : undefined } });

  const summary: SocialMediaSummary = {
    modelCount: modelsWithAccounts.length,
    connectedAccountCount,
    scheduledCount: rows.filter((r) => r.state === "SCHEDULED").length,
    awaitingApprovalCount: rows.filter((r) => r.state === "AWAITING_APPROVAL").length,
    readyCount: rows.filter((r) => r.state === "READY").length,
    failedCount: rows.filter((r) => r.state === "FAILED").length,
  };

  return { summary, models, posts: rows };
}
