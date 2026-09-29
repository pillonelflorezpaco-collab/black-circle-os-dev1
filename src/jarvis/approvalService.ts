import { Prisma, type Approval, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taskRepository } from "@/repositories/task.repository";
import { approvalRepository } from "@/repositories/approval.repository";
import { eventRepository } from "@/repositories/event.repository";
import { assertCan, assertSameAgency, ForbiddenError } from "@/lib/permissions";
import { evaluateApprovalRequirement } from "./approvalPolicy";
import type { RiskLevel } from "./types";

export type CreateApprovalResult =
  | { approvalRequired: false; riskLevel: RiskLevel; reason: string; approval: null }
  | { approvalRequired: true; riskLevel: RiskLevel; reason: string; approval: Approval };

/**
 * Evaluates whether a just-created Task requires human approval and, if so,
 * persists exactly one PENDING Approval and moves the Task to
 * WAITING_APPROVAL. Never executes anything — see docs/approval-engine.md.
 *
 * Idempotent: a task can never have two simultaneous PENDING approvals, both
 * because this checks first AND because the database enforces it (partial
 * unique index Approval_task_pending_unique) — a concurrent duplicate insert
 * is caught and the existing row is returned instead.
 */
export async function createApprovalForTask(taskId: string, requestedById: string): Promise<CreateApprovalResult> {
  const task = await taskRepository.findById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  if (!task.riskLevel || !["LOW", "MEDIUM", "HIGH"].includes(task.riskLevel)) {
    throw new Error(`Task ${taskId} has no valid riskLevel; cannot evaluate approval requirement.`);
  }

  const decision = evaluateApprovalRequirement(task.riskLevel as RiskLevel);
  if (!decision.approvalRequired) {
    return { approvalRequired: false, riskLevel: decision.riskLevel, reason: decision.reason, approval: null };
  }

  const existing = await approvalRepository.findPendingForTask(taskId);
  if (existing) {
    return { approvalRequired: true, riskLevel: decision.riskLevel, reason: decision.reason, approval: existing };
  }

  let approval: Approval;
  try {
    approval = await approvalRepository.create({
      agency: { connect: { id: task.agencyId } },
      task: { connect: { id: task.id } },
      status: "PENDING",
      riskLevel: decision.riskLevel,
      requestedBy: { connect: { id: requestedById } },
      reason: decision.reason,
    });
  } catch (err) {
    // Unique constraint race: another request created the PENDING approval
    // between our check and our insert — fetch and return it rather than fail.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await approvalRepository.findPendingForTask(taskId);
      if (raced) return { approvalRequired: true, riskLevel: decision.riskLevel, reason: decision.reason, approval: raced };
    }
    throw err;
  }

  await taskRepository.update(taskId, { status: "WAITING_APPROVAL" });

  await eventRepository.create({
    type: "TASK_APPROVAL_REQUESTED",
    message: `Approbation requise pour la tâche : ${task.title}`,
    metadata: { taskId: task.id, approvalId: approval.id, riskLevel: decision.riskLevel },
    agency: { connect: { id: task.agencyId } },
  });

  return { approvalRequired: true, riskLevel: decision.riskLevel, reason: decision.reason, approval };
}

interface Actor {
  id: string;
  role: Role;
  agencyId: string | null;
}

export type DecisionResult = { status: "OK"; approval: Approval } | { status: "FORBIDDEN"; reason: string } | { status: "NOT_FOUND" } | { status: "INVALID_STATE"; reason: string };

/**
 * APPROVE. Sets Approval.status = APPROVED and moves the Task to READY —
 * explicitly NOT IN_PROGRESS/COMPLETED. READY only means "no longer
 * blocked on a human decision"; no Execution Engine exists yet to act on it
 * (see docs/approval-engine.md §9/§13).
 */
export async function approveApproval(approvalId: string, actor: Actor, decisionNote?: string): Promise<DecisionResult> {
  const approval = await approvalRepository.findById(approvalId);
  if (!approval) return { status: "NOT_FOUND" };

  try {
    assertCan(actor.role, "approuverTaches");
    assertSameAgency(actor.agencyId, approval.agencyId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { status: "FORBIDDEN", reason: err.message };
    throw err;
  }

  if (approval.status !== "PENDING") {
    return { status: "INVALID_STATE", reason: `Approval is already ${approval.status}, not PENDING.` };
  }

  const updated = await approvalRepository.update(approvalId, {
    status: "APPROVED",
    decidedBy: { connect: { id: actor.id } },
    decidedAt: new Date(),
    decisionNote: decisionNote ?? null,
  });

  await taskRepository.update(approval.taskId, { status: "READY" });

  await eventRepository.create({
    type: "TASK_APPROVED",
    message: `Approbation accordée pour la tâche ${approval.taskId}`,
    metadata: { taskId: approval.taskId, approvalId: approval.id, decidedById: actor.id },
    agency: { connect: { id: approval.agencyId } },
  });

  return { status: "OK", approval: updated };
}

/**
 * REJECT. Sets Approval.status = REJECTED and moves the Task to CANCELLED —
 * the existing TaskStatus enum's terminal "will not proceed" state (there is
 * no separate "rejected" task status, and inventing one for a single
 * decision path would duplicate what CANCELLED already means).
 */
export async function rejectApproval(approvalId: string, actor: Actor, reason: string): Promise<DecisionResult> {
  const approval = await approvalRepository.findById(approvalId);
  if (!approval) return { status: "NOT_FOUND" };

  try {
    assertCan(actor.role, "approuverTaches");
    assertSameAgency(actor.agencyId, approval.agencyId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { status: "FORBIDDEN", reason: err.message };
    throw err;
  }

  if (approval.status !== "PENDING") {
    return { status: "INVALID_STATE", reason: `Approval is already ${approval.status}, not PENDING.` };
  }

  const updated = await approvalRepository.update(approvalId, {
    status: "REJECTED",
    decidedBy: { connect: { id: actor.id } },
    decidedAt: new Date(),
    decisionNote: reason,
  });

  await taskRepository.update(approval.taskId, { status: "CANCELLED" });

  await eventRepository.create({
    type: "TASK_REJECTED",
    message: `Approbation refusée pour la tâche ${approval.taskId}`,
    metadata: { taskId: approval.taskId, approvalId: approval.id, decidedById: actor.id, reason },
    agency: { connect: { id: approval.agencyId } },
  });

  return { status: "OK", approval: updated };
}

/** Fetches the acting User's coarse role/agency for the approve/reject authorization check. */
export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, agencyId: true } });
  return user;
}
