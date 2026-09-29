import { Prisma, type OrchestrationRecord } from "@prisma/client";
import { orchestrationRepository } from "@/repositories/orchestration.repository";
import { taskRepository } from "@/repositories/task.repository";
import { planJarvisRequest } from "@/jarvis/core";
import { createTaskFromJarvisPlan } from "@/jarvis/taskService";
import { createApprovalForTask } from "@/jarvis/approvalService";
import { createExecutionForTask } from "@/execution/executionService";
import type { JarvisPlan, JarvisRequest } from "@/jarvis/types";
import type { OrchestrationRequest, StartOrchestrationResult } from "./types";
import type { Role } from "@prisma/client";

interface Actor {
  id: string;
  role: Role;
  agencyId: string | null;
}

/**
 * Jarvis Orchestrator v0.1a — see docs/orchestrator.md.
 *
 * Coordinates the existing engines in sequence; it never re-implements their
 * decisions. Every step below calls an already-existing, already-tested
 * function (planJarvisRequest / createTaskFromJarvisPlan /
 * createApprovalForTask / createExecutionForTask) and only persists which
 * state that coordination has reached.
 *
 * CRITICAL: this function contains no code path that sets Approval.status to
 * APPROVED, and no code path that calls createExecutionForTask while a
 * required Approval is still PENDING. The only way an Approval becomes
 * APPROVED is a human calling approveApproval() directly (a separate,
 * session-authed request) — see "Approval boundary" in docs/orchestrator.md.
 */
export async function startOrchestration(request: OrchestrationRequest, actor: Actor): Promise<StartOrchestrationResult> {
  const orchestration = await getOrCreateOrchestration(request);

  // Idempotency: an orchestration that has already progressed past REQUESTED
  // for this requestId is not restarted — reuse it as-is, plan unknown to
  // this call (the caller can re-fetch the plan separately if needed). This
  // is what makes a retried request with the same requestId safe to call
  // again without redoing work or creating a second Task/Approval.
  if (orchestration.state !== "REQUESTED") {
    return { orchestration: toView(orchestration), plan: null };
  }

  // Atomic claim (see orchestration.repository.ts) — if another concurrent
  // call for the same requestId already claimed this exact row, don't
  // duplicate the work: reuse whatever state it's reached instead.
  const claimed = await orchestrationRepository.claimForPlanning(orchestration.id);
  if (!claimed) {
    const current = await orchestrationRepository.findById(orchestration.id);
    return { orchestration: toView(current ?? orchestration), plan: null };
  }

  const plan = await planJarvisRequest(request);
  return continueFromPlan(orchestration.id, request, plan, actor);
}

/**
 * Everything after a plan exists: task creation, approval evaluation, and
 * the (currently unreachable in practice — see docs/orchestrator.md
 * "Known limitation") execution hand-off. Factored out from
 * startOrchestration() purely so it can be exercised directly in tests with
 * a plan that already carries a HIGH riskLevel — the real seeded Neo4j graph
 * has no HIGH-risk capability today, the same limitation
 * src/jarvis/__tests__/run.ts already works around for approvalService by
 * testing it against a synthetic task rather than through planJarvisRequest.
 * This is NOT the V0.1b "resume a persisted orchestration after a process
 * restart" feature — it takes the plan as a parameter, it does not load one
 * from storage — and is not exported as a second public entry point for
 * callers to use instead of startOrchestration().
 */
async function continueFromPlan(orchestrationId: string, request: JarvisRequest, plan: JarvisPlan, actor: Actor): Promise<StartOrchestrationResult> {
  if (plan.status !== "DRY_RUN") {
    const updated = await orchestrationRepository.updateState(orchestrationId, "NEEDS_CLARIFICATION", plan.reason ?? plan.status);
    return { orchestration: toView(updated), plan };
  }

  const taskResult = await createTaskFromJarvisPlan(request, plan);
  if (taskResult.status === "REJECTED") {
    const updated = await orchestrationRepository.updateState(orchestrationId, "FAILED", taskResult.reason);
    return { orchestration: toView(updated), plan };
  }

  await orchestrationRepository.attachTask(orchestrationId, taskResult.task.id);
  let current = await orchestrationRepository.updateState(orchestrationId, "TASK_CREATED");

  // Approval Engine remains the sole authority on whether approval is
  // required and the sole authority on granting it. This call only reads
  // that decision and, if an Approval was created, records its id — it
  // never sets Approval.status itself.
  const approvalDecision = await createApprovalForTask(taskResult.task.id, actor.id);
  if (approvalDecision.approvalRequired) {
    await orchestrationRepository.attachApproval(orchestrationId, approvalDecision.approval.id);
    current = await orchestrationRepository.updateState(orchestrationId, "AWAITING_APPROVAL");
    return { orchestration: toView(current), plan };
  }

  // No approval required. This does NOT mean execution is allowed — only
  // Task.status === "READY" (set exclusively by approveApproval(), or by a
  // future Task Engine transition this orchestrator does not invent) means
  // that. Re-reading the real Task row rather than assuming lets this stay
  // correct if that invariant ever changes, without touching this file.
  const freshTask = await taskRepository.findById(taskResult.task.id);
  if (freshTask?.status !== "READY") {
    return { orchestration: toView(current), plan };
  }

  const executionResult = await createExecutionForTask(taskResult.task.id, actor);
  if (executionResult.status !== "CREATED") {
    const reason = "reason" in executionResult ? executionResult.reason : executionResult.status;
    const updated = await orchestrationRepository.updateState(orchestrationId, "FAILED", reason);
    return { orchestration: toView(updated), plan };
  }

  await orchestrationRepository.attachExecution(orchestrationId, executionResult.execution.id);
  const executing = await orchestrationRepository.updateState(orchestrationId, "EXECUTING");
  return { orchestration: toView(executing), plan };
}

async function getOrCreateOrchestration(request: OrchestrationRequest): Promise<OrchestrationRecord> {
  if (request.requestId) {
    const existing = await orchestrationRepository.findByRequestId(request.agencyId, request.requestId);
    if (existing) return existing;
  }

  try {
    return await orchestrationRepository.create({
      agencyId: request.agencyId,
      requestId: request.requestId ?? null,
    });
  } catch (err) {
    // Unique constraint race on (agencyId, requestId) — another concurrent
    // call created it first. Fetch and reuse rather than fail or duplicate.
    if (request.requestId && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await orchestrationRepository.findByRequestId(request.agencyId, request.requestId);
      if (raced) return raced;
    }
    throw err;
  }
}

function toView(record: OrchestrationRecord) {
  return {
    id: record.id,
    agencyId: record.agencyId,
    requestId: record.requestId,
    state: record.state,
    failureReason: record.failureReason,
    taskId: record.taskId,
    approvalId: record.approvalId,
    executionId: record.executionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Exported for tests only (see continueFromPlan's doc comment above) — not
// part of the Orchestrator's real entry-point surface. startOrchestration()
// is the only function anything outside this module and its tests should call.
export const __testing = { continueFromPlan, getOrCreateOrchestration };
