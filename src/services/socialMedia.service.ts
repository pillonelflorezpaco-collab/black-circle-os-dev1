import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";

export const APPROVAL_STATE_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const EXECUTION_STATE_LABEL: Record<string, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  AWAITING_CALLBACK: "Awaiting callback",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  TIMED_OUT: "Timed out",
  CANCELLED: "Cancelled",
};

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
  thumbnailUrl: string | null;
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
      thumbnailUrl: post.video.thumbnailUrl,
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

// ─────────────────────────────────────────────────────────────
// POST DETAIL — single post, fully resolved for the detail panel /
// "Blotato Preview". Never selects BlotatoAccount.apiKey or
// PlatformConnection.accessTokenEnc/refreshTokenEnc — this is a read-only
// preview, not a credential surface.
// ─────────────────────────────────────────────────────────────

export interface SocialMediaPostDetailData {
  id: string;
  platform: Platform;
  scheduledTime: Date;
  postStatus: string;
  publicUrl: string | null;
  errorMessage: string | null;
  model: { id: string; name: string; logoUrl: string | null };
  video: { title: string; caption: string | null; driveUrl: string | null; thumbnailUrl: string | null; stage: string };
  account: {
    displayName: string | null;
    platform: Platform;
    source: string;
    isActive: boolean;
    blotatoAccountRef: string | null;
    blotatoAccountLabel: string | null;
    platformConnection: { externalAccountId: string; status: string; lastError: string | null } | null;
  };
  state: SocialMediaPostState;
  task: { id: string; status: string; riskLevel: string | null } | null;
  approval: { id: string; status: string; riskLevel: string; reason: string | null; decisionNote: string | null; decidedAt: Date | null } | null;
  execution: { id: string; status: string; startedAt: Date | null; finishedAt: Date | null; failureReason: string | null } | null;
}

/** `null` return means not found OR not in this agency — same no-leak shape as the rest of the app (never distinguishes the two). */
export async function getPostDetail(postId: string, agencyId: string | null): Promise<SocialMediaPostDetailData | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      video: { include: { model: { select: { id: true, name: true, logoUrl: true } } } },
      socialAccount: {
        include: {
          blotatoAccount: { select: { label: true } },
          platformConnection: { select: { externalAccountId: true, status: true, lastError: true } },
        },
      },
    },
  });

  if (!post || (agencyId && post.agencyId !== agencyId)) return null;

  const task = await prisma.task.findFirst({
    where: { entityType: "POST", entityId: post.id, ...(agencyId ? { agencyId } : {}) },
    include: {
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      executions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const approval = task?.approvals[0] ?? null;
  const execution = task?.executions[0] ?? null;

  return {
    id: post.id,
    platform: post.platform,
    scheduledTime: post.scheduledTime,
    postStatus: post.status,
    publicUrl: post.publicUrl,
    errorMessage: post.errorMessage,
    model: post.video.model,
    video: { title: post.video.title, caption: post.video.caption, driveUrl: post.video.driveUrl, thumbnailUrl: post.video.thumbnailUrl, stage: post.video.stage },
    account: {
      displayName: post.socialAccount.displayName,
      platform: post.socialAccount.platform,
      source: post.socialAccount.source,
      isActive: post.socialAccount.isActive,
      blotatoAccountRef: post.socialAccount.blotatoAccountRef,
      blotatoAccountLabel: post.socialAccount.blotatoAccount?.label ?? null,
      platformConnection: post.socialAccount.platformConnection,
    },
    state: deriveSocialMediaState(post.status, task ? { id: task.id, status: task.status, approvals: task.approvals, executions: task.executions } : undefined),
    task: task ? { id: task.id, status: task.status, riskLevel: task.riskLevel } : null,
    approval: approval ? { id: approval.id, status: approval.status, riskLevel: approval.riskLevel, reason: approval.reason, decisionNote: approval.decisionNote, decidedAt: approval.decidedAt } : null,
    execution: execution ? { id: execution.id, status: execution.status, startedAt: execution.startedAt, finishedAt: execution.finishedAt, failureReason: execution.failureReason } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// CALENDAR — same date-bounded-query shape as post.service.ts's
// getCalendarMonth (never queries the whole table), but returns enough per
// post (id + derived state) for click-through to the detail panel, which
// that function's simple {platform,color,title} chip shape doesn't carry.
// Not a second calendar/persistence system — same Post table, same
// month-boundary query pattern, just a richer projection for this view.
// ─────────────────────────────────────────────────────────────

export interface SocialMediaCalendarPost {
  id: string;
  day: number;
  platform: Platform;
  modelName: string;
  state: SocialMediaPostState;
}

export async function getSocialMediaCalendar(agencyId: string | null, year: number, month: number, filters: SocialMediaFilters = {}): Promise<SocialMediaCalendarPost[]> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const agencyScope = agencyId ? { agencyId } : {};

  const posts = await prisma.post.findMany({
    where: {
      scheduledTime: { gte: start, lt: end },
      ...agencyScope,
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.modelId ? { video: { modelId: filters.modelId } } : {}),
    },
    include: { video: { select: { modelId: true, model: { select: { name: true } } } } },
    orderBy: { scheduledTime: "asc" },
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
  const taskByPostId = new Map<string, LinkedTask>();
  for (const task of tasks) {
    if (!task.entityId || taskByPostId.has(task.entityId)) continue;
    taskByPostId.set(task.entityId, task);
  }

  let results = posts.map((post) => ({
    id: post.id,
    day: new Date(post.scheduledTime).getUTCDate(),
    platform: post.platform,
    modelName: post.video.model.name,
    state: deriveSocialMediaState(post.status, taskByPostId.get(post.id)),
  }));

  if (filters.state) results = results.filter((r) => r.state === filters.state);
  return results;
}

// ─────────────────────────────────────────────────────────────
// ACCOUNTS — Model → Platform → Account tree. Never selects
// BlotatoAccount.apiKey or PlatformConnection.accessTokenEnc/
// refreshTokenEnc/scopes — display identifiers and status only.
// ─────────────────────────────────────────────────────────────

export interface SocialMediaAccountRow {
  id: string;
  platform: Platform;
  displayName: string | null;
  isActive: boolean;
  source: string;
  blotatoAccountRef: string | null;
  blotatoAccountLabel: string | null;
  platformConnection: { externalAccountId: string; status: string; lastError: string | null } | null;
}

export interface SocialMediaAccountModelRow {
  id: string;
  name: string;
  logoUrl: string | null;
  accounts: SocialMediaAccountRow[];
}

export async function getSocialMediaAccounts(agencyId: string | null): Promise<SocialMediaAccountModelRow[]> {
  const models = await prisma.model.findMany({
    where: { ...(agencyId ? { agencyId } : {}), socialAccounts: { some: {} } },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      socialAccounts: {
        select: {
          id: true,
          platform: true,
          displayName: true,
          isActive: true,
          source: true,
          blotatoAccountRef: true,
          blotatoAccount: { select: { label: true } },
          platformConnection: { select: { externalAccountId: true, status: true, lastError: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return models.map((model) => ({
    id: model.id,
    name: model.name,
    logoUrl: model.logoUrl,
    accounts: model.socialAccounts.map((sa) => ({
      id: sa.id,
      platform: sa.platform,
      displayName: sa.displayName,
      isActive: sa.isActive,
      source: sa.source,
      blotatoAccountRef: sa.blotatoAccountRef,
      blotatoAccountLabel: sa.blotatoAccount?.label ?? null,
      platformConnection: sa.platformConnection,
    })),
  }));
}
