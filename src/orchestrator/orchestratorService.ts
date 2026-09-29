import { Prisma, type OrchestrationRecord } from "@prisma/client";
import { orchestrationRepository } from "@/repositories/orchestration.repository";
import { taskRepository } from "@/repositories/task.repository";
import { approvalRepository } from "@/repositories/approval.repository";
import { executionRepository } from "@/repositories/execution.repository";
import { planJarvisRequest } from "@/jarvis/core";
import { createTaskFromJarvisPlan } from "@/jarvis/taskService";
import { createApprovalForTask } from "@/jarvis/approvalService";
import { createExecutionForTask } from "@/execution/executionService";
import { assertSameAgency, ForbiddenError } from "@/lib/permissions";
import type { JarvisPlan, JarvisRequest } from "@/jarvis/types";
import type { OrchestrationRequest, ResumeOrchestrationResult, StartOrchestrationResult } from "./types";
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

/**
 * Jarvis Orchestrator v0.1b — resume path. See docs/orchestrator.md
 * "Resume boundary (v0.1b)".
 *
 * CRITICAL SECURITY INVARIANT: OrchestrationRecord.state is NEVER read here
 * to decide whether execution is authorized. Every authorization decision
 * below is re-derived from a fresh read of the real Approval/Task rows (or,
 * for "has this already been resumed," from OrchestrationRecord.executionId
 * — presence of an attached execution id, not the state label). A caller
 * that somehow set state to "EXECUTING" without a real APPROVED Approval and
 * a real READY Task gets rejected exactly the same as if state still said
 * "AWAITING_APPROVAL" — the state field carries no authority.
 *
 * This function never sets Approval.status, never calls approveApproval(),
 * and never calls createExecutionForTask() unless the actual Approval (if
 * one was required) is APPROVED and the actual Task is READY.
 */
export async function resumeOrchestration(orchestrationId: string, actor: Actor): Promise<ResumeOrchestrationResult> {
  const orchestration = await orchestrationRepository.findById(orchestrationId);
  if (!orchestration) return { status: "NOT_FOUND" };

  try {
    assertSameAgency(actor.agencyId, orchestration.agencyId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { status: "FORBIDDEN", reason: err.message };
    throw err;
  }

  // Idempotent short-circuit: an execution was already attached by a prior
  // resume call. This is checked via the attached id, never via
  // orchestration.state, so it is safe even if state was never updated for
  // some reason — presence of the id is the only thing that matters.
  if (orchestration.executionId) {
    return { status: "ALREADY_RESUMED", orchestration: toView(orchestration) };
  }

  if (!orchestration.taskId) {
    return { status: "NOT_RESUMABLE", reason: "This orchestration never reached TASK_CREATED — there is no Task to resume." };
  }

  // Approval Engine remains the sole authority: if this orchestration
  // recorded that approval was required (approvalId set during
  // startOrchestration), the real, current Approval row is re-read here.
  // Its status is never inferred from OrchestrationRecord.state.
  if (orchestration.approvalId) {
    const approval = await approvalRepository.findById(orchestration.approvalId);
    if (!approval || approval.status !== "APPROVED") {
      return {
        status: "APPROVAL_PENDING",
        reason: approval ? `Approval is ${approval.status}, not APPROVED.` : "Approval record not found.",
        orchestration: toView(orchestration),
      };
    }
  }

  // Task Engine remains the sole authority: execution is only attempted
  // once the real, current Task row is READY. Never inferred from
  // Approval.status or OrchestrationRecord.state.
  const task = await taskRepository.findById(orchestration.taskId);
  if (task?.status !== "READY") {
    return {
      status: "TASK_NOT_READY",
      reason: `Task is ${task?.status ?? "missing"}, not READY.`,
      orchestration: toView(orchestration),
    };
  }

  // Execution Engine remains the sole execution authority — this re-checks
  // permission, agency, HIGH-risk-approval, and tool support itself, and is
  // idempotent on (taskId, idempotencyKey): a second/concurrent resume call
  // that reaches this line for the same Task gets the SAME Execution row
  // back rather than a duplicate (see execution/executionService.ts and its
  // own concurrency test) — no additional lock is introduced here.
  const executionResult = await createExecutionForTask(orchestration.taskId, actor);
  if (executionResult.status !== "CREATED") {
    const reason = "reason" in executionResult ? executionResult.reason : executionResult.status;
    const updated = await orchestrationRepository.updateState(orchestration.id, "FAILED", reason);
    return { status: "EXECUTION_FAILED", reason, orchestration: toView(updated) };
  }

  await orchestrationRepository.attachExecution(orchestration.id, executionResult.execution.id);

  // Smallest accurate state transition — never claim COMPLETED just because
  // createExecutionForTask() returned successfully; the underlying
  // Execution may still be PENDING/RUNNING/AWAITING_CALLBACK. Only mirror
  // SUCCEEDED/FAILED when the Execution itself has already reached that
  // terminal state synchronously; otherwise EXECUTING is the accurate,
  // non-presumptuous label — no new OrchestrationState value is introduced.
  const nextState = executionResult.execution.status === "SUCCEEDED" ? "COMPLETED" : executionResult.execution.status === "FAILED" ? "FAILED" : "EXECUTING";
  const updated = await orchestrationRepository.updateState(orchestration.id, nextState, executionResult.execution.status === "FAILED" ? executionResult.execution.failureReason : undefined);

  return { status: "RESUMED", orchestration: toView(updated) };
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
