import { prisma } from "@/lib/prisma";
import { orchestrationRepository } from "@/repositories/orchestration.repository";
import type { OrchestrationState } from "@prisma/client";

/**
 * Read-only data access for the BlackOS Command Center. Queries the same
 * Task/Approval/Event/Model tables the Jarvis/Task/Approval engines already
 * write to, via Prisma directly — this file does not import from, or
 * modify, src/jarvis/** (Jarvis Core / Task Engine / Approval Engine
 * remain untouched). No fake data: every value here is a real query result.
 */

// Agent/department counts come from Neo4j (see organization.service.ts), not
// Postgres — the Command Center page merges both into one summary.
export async function getCommandCenterCounts(agencyId: string | null) {
  const where = agencyId ? { agencyId } : {};
  const [taskCount, pendingApprovalCount, modelCount, eventCount] = await Promise.all([
    prisma.task.count({ where }),
    prisma.approval.count({ where: { ...where, status: "PENDING" } }),
    prisma.model.count({ where }),
    prisma.event.count({ where }),
  ]);
  return { taskCount, pendingApprovalCount, modelCount, eventCount };
}

/**
 * Real tasks, enriched with the referenced Model's real name for display
 * (Task.entityId/entityType are plain strings, not a Prisma relation — see
 * docs/task-engine.md §6 — so this is a small follow-up read, not a schema
 * change). `entityName` is undefined when there's no entity or it's not a
 * Model; never a fabricated fallback string.
 */
export async function getRecentTasks(agencyId: string | null, take = 6) {
  const tasks = await prisma.task.findMany({
    where: agencyId ? { agencyId } : {},
    orderBy: { createdAt: "desc" },
    take,
  });

  const modelIds = tasks.filter((t) => t.entityType === "MODEL" && t.entityId).map((t) => t.entityId as string);
  const models = modelIds.length > 0 ? await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(models.map((m) => [m.id, m.name]));

  return tasks.map((task) => ({ ...task, entityName: task.entityId ? nameById.get(task.entityId) : undefined }));
}

export function getPendingApprovals(agencyId: string | null, take = 6) {
  return prisma.approval.findMany({
    where: { ...(agencyId ? { agencyId } : {}), status: "PENDING" },
    include: { task: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function getRecentEvents(agencyId: string | null, take = 8) {
  return prisma.event.findMany({
    where: agencyId ? { agencyId } : {},
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Real attention items for the Command Center's attention panel — pending
 * approvals plus any blocked/failed tasks. BLOCKED/FAILED are valid
 * TaskStatus values (Task Engine v0.1 schema) but no code currently
 * transitions a task into either state, so these counts will legitimately
 * be 0 today — that's an honest reflection of the system, not a bug.
 */
export async function getAttentionCounts(agencyId: string | null) {
  const where = agencyId ? { agencyId } : {};
  const [pendingApprovals, blockedTasks, failedTasks] = await Promise.all([
    prisma.approval.count({ where: { ...where, status: "PENDING" } }),
    prisma.task.count({ where: { ...where, status: "BLOCKED" } }),
    prisma.task.count({ where: { ...where, status: "FAILED" } }),
  ]);
  return { pendingApprovals, blockedTasks, failedTasks };
}

/**
 * Jarvis Orchestrator observability (v0.1d) — see docs/orchestrator.md
 * "Command Center observability". Read-only: calls
 * orchestrationRepository.findRecent() only, never
 * startOrchestration()/resumeOrchestration() or any mutating engine
 * function. Returns a thin projection (OrchestrationRecordView's shape,
 * field-renamed for display) — never the raw Prisma OrchestrationRecord —
 * and never duplicates the referenced Task/Approval/Execution's own mutable
 * fields; the panel shows only whether each is present (via the id), which
 * is exactly what the OrchestrationRecord itself already stores.
 */
export interface RecentOrchestration {
  orchestrationId: string;
  requestId: string | null;
  state: OrchestrationState;
  taskId: string | null;
  approvalId: string | null;
  executionId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getRecentOrchestrations(agencyId: string | null, opts?: { state?: OrchestrationState; take?: number }): Promise<RecentOrchestration[]> {
  const records = await orchestrationRepository.findRecent(agencyId, opts);
  return records.map((record) => ({
    orchestrationId: record.id,
    requestId: record.requestId,
    state: record.state,
    taskId: record.taskId,
    approvalId: record.approvalId,
    executionId: record.executionId,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}
