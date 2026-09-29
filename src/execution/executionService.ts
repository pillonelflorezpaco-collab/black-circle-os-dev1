import { Prisma, type Execution, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taskRepository } from "@/repositories/task.repository";
import { executionRepository } from "@/repositories/execution.repository";
import { executionStepRepository } from "@/repositories/executionStep.repository";
import { eventRepository } from "@/repositories/event.repository";
import { assertCan, assertSameAgency, ForbiddenError } from "@/lib/permissions";
import { resolveCapabilityContext } from "@/jarvis/graphResolver";
import { triggerTestWorkflow } from "./n8nClient";
import { dryRunPublish } from "./blotatoAdapter";
import { capabilityAlwaysRequiresApproval } from "@/jarvis/approvalPolicy";
import type { IntentKey } from "@/jarvis/types";

// v0.1a supported exactly one tool ("n8n", the zero-side-effect test
// adapter). v0.1's social-media-execution phase adds "blackos_api" —
// resolved DRY_RUN ONLY via blotatoAdapter.dryRunPublish(); real publishing
// is implemented in that module but not wired in here — see
// docs/social-media-execution.md "Real publish boundary". Any other tool
// key is still correctly reported as unsupported rather than silently
// attempted — see docs/execution-engine.md §6.
const SUPPORTED_TOOL_KEYS = new Set(["n8n", "blackos_api"]);
const TEST_WORKFLOW_REF = "blackos-execution-test";

interface Actor {
  id: string;
  role: Role;
  agencyId: string | null;
}

export type CreateExecutionResult =
  | { status: "CREATED"; execution: Execution }
  | { status: "NOT_FOUND" }
  | { status: "FORBIDDEN"; reason: string }
  | { status: "INVALID_STATE"; reason: string }
  | { status: "APPROVAL_REQUIRED"; reason: string }
  | { status: "UNSUPPORTED_TOOL"; reason: string };

/**
 * Creates (or returns the existing) Execution for a Task, after re-verifying
 * every precondition server-side. Never trusts a caller-supplied tool,
 * workflow, risk, approval, agency, or execution status — all of it is
 * re-derived from the Task row and the Neo4j graph. See
 * docs/execution-engine.md §5.
 */
export async function createExecutionForTask(taskId: string, actor: Actor, opts?: { postId?: string }): Promise<CreateExecutionResult> {
  const task = await taskRepository.findById(taskId);
  if (!task) return { status: "NOT_FOUND" };

  try {
    assertSameAgency(actor.agencyId, task.agencyId);
    assertCan(actor.role, "executerTaches");
  } catch (err) {
    if (err instanceof ForbiddenError) return { status: "FORBIDDEN", reason: err.message };
    throw err;
  }

  if (task.status !== "READY") {
    return { status: "INVALID_STATE", reason: `Task is ${task.status}, not READY.` };
  }
  if (!task.capabilityKey) {
    return { status: "INVALID_STATE", reason: "Task has no capabilityKey." };
  }

  // HIGH risk, or a capability the centralized approval policy always
  // requires approval for regardless of risk (see approvalPolicy.ts —
  // reused here, never duplicated, so this stays the single source of
  // truth for "which tasks need an APPROVED Approval"), requires a real
  // APPROVED Approval for this exact task — re-checked here, never trusted
  // from the caller (Task.status === READY already implies this in the
  // current Approval Engine flow, but this execution-side check is what
  // makes that invariant load-bearing rather than assumed).
  if (task.riskLevel === "HIGH" || capabilityAlwaysRequiresApproval(task.capabilityKey)) {
    const approved = await prisma.approval.findFirst({ where: { taskId: task.id, status: "APPROVED" } });
    if (!approved) {
      return { status: "APPROVAL_REQUIRED", reason: "This task requires an APPROVED Approval before it can be executed." };
    }
  }

  // Tool/workflow resolution — authoritative, from the Neo4j graph, never
  // from anything the caller supplied.
  const graph = await resolveCapabilityContext(task.capabilityKey as IntentKey);
  const toolKey = graph?.tools[0]?.key;
  if (!toolKey || !SUPPORTED_TOOL_KEYS.has(toolKey)) {
    return { status: "UNSUPPORTED_TOOL", reason: `Capability "${task.capabilityKey}" resolves to tool "${toolKey ?? "none"}", which Execution Engine v0.1 does not support.` };
  }

  const attempt = 1; // v0.1: no retries yet — every Execution is attempt 1 (see docs/execution-engine.md §12)
  const idempotencyKey = `${task.id}:${attempt}`;

  const existing = await executionRepository.findByTaskAndIdempotencyKey(task.id, idempotencyKey);
  if (existing) {
    return { status: "CREATED", execution: existing };
  }

  let execution: Execution;
  try {
    execution = await executionRepository.create({
      agency: { connect: { id: task.agencyId } },
      task: { connect: { id: task.id } },
      status: "PENDING",
      toolKey,
      workflowRef: TEST_WORKFLOW_REF,
      requestedBy: { connect: { id: actor.id } },
      idempotencyKey,
      attempt,
    });
  } catch (err) {
    // Unique constraint race — another request created it between our
    // check and our insert. Fetch and return it rather than failing.
    const raced = await executionRepository.findByTaskAndIdempotencyKey(task.id, idempotencyKey);
    if (raced) return { status: "CREATED", execution: raced };
    throw err;
  }

  await executionStepRepository.create({
    execution: { connect: { id: execution.id } },
    sequence: 1,
    kind: toolKey === "blackos_api" ? "BLOTATO_DRY_RUN" : "N8N_WORKFLOW",
    status: "PENDING",
    input: { executionId: execution.id, taskId: task.id, idempotencyKey, agencyId: task.agencyId, capabilityKey: task.capabilityKey },
  });

  // READY → IN_PROGRESS, RUNNING, dispatch.
  await taskRepository.update(task.id, { status: "IN_PROGRESS" });
  await executionRepository.update(execution.id, { status: "RUNNING", startedAt: new Date() });

  await eventRepository.create({
    type: "WORKFLOW_STARTED",
    message: `Execution started for task: ${task.title}`,
    metadata: { taskId: task.id, executionId: execution.id, toolKey },
    agency: { connect: { id: task.agencyId } },
  });

  if (toolKey === "blackos_api") {
    return dispatchBlotatoDryRun(execution, task, opts?.postId);
  }

  const trigger = await triggerTestWorkflow({
    executionId: execution.id,
    taskId: task.id,
    idempotencyKey,
    agencyId: task.agencyId,
    capabilityKey: task.capabilityKey,
  });

  if (!trigger.ok) {
    const failed = await executionRepository.update(execution.id, {
      status: "FAILED",
      finishedAt: new Date(),
      failureReason: trigger.error,
    });
    await taskRepository.update(task.id, { status: "FAILED" });
    await eventRepository.create({
      type: "WORKFLOW_FAILED",
      message: `Execution failed to dispatch for task: ${task.title}`,
      metadata: { taskId: task.id, executionId: execution.id, toolKey },
      agency: { connect: { id: task.agencyId } },
    });
    return { status: "CREATED", execution: failed };
  }

  const awaiting = await executionRepository.update(execution.id, { status: "AWAITING_CALLBACK" });
  return { status: "CREATED", execution: awaiting };
}

/**
 * Dry-run only (see blotatoAdapter.ts's module doc for why). Unlike the n8n
 * path, this is synchronous and never leaves AWAITING_CALLBACK — there is no
 * callback for a dry run, so the Execution reaches a terminal state
 * (SUCCEEDED/FAILED) immediately, in this same call.
 */
async function dispatchBlotatoDryRun(execution: Execution, task: { id: string; title: string; agencyId: string }, postId: string | undefined): Promise<CreateExecutionResult> {
  if (!postId) {
    const failed = await executionRepository.update(execution.id, {
      status: "FAILED",
      finishedAt: new Date(),
      failureReason: "postId is required to execute a social_media_management task.",
    });
    await taskRepository.update(task.id, { status: "FAILED" });
    await eventRepository.create({
      type: "WORKFLOW_FAILED",
      message: `Execution failed to dispatch for task: ${task.title}`,
      metadata: { taskId: task.id, executionId: execution.id, toolKey: "blackos_api" },
      agency: { connect: { id: task.agencyId } },
    });
    return { status: "CREATED", execution: failed };
  }

  const result = await dryRunPublish(postId, task.agencyId);

  if (!result.ok) {
    const failed = await executionRepository.update(execution.id, {
      status: "FAILED",
      finishedAt: new Date(),
      failureReason: result.message,
    });
    await taskRepository.update(task.id, { status: "FAILED" });
    await eventRepository.create({
      type: "WORKFLOW_FAILED",
      message: `Execution failed to dispatch for task: ${task.title}`,
      metadata: { taskId: task.id, executionId: execution.id, toolKey: "blackos_api" },
      agency: { connect: { id: task.agencyId } },
    });
    return { status: "CREATED", execution: failed };
  }

  // dryRunPublish() only ever resolves to the dryRun: true variant on
  // success — narrowed explicitly rather than asserted, so a future change
  // to blotatoAdapter.ts can't silently make this unsafe.
  // Plain-serialized so Prisma's Json input accepts it (BlotatoCreatePostRequest
  // is a typed interface, not an index-signature object) — a structural copy,
  // not a redaction: the request never contains the API key in the first place.
  const requestForAudit = JSON.parse(JSON.stringify(result.dryRun ? result.request : null)) as Prisma.InputJsonValue;
  const succeeded = await executionRepository.update(execution.id, {
    status: "SUCCEEDED",
    finishedAt: new Date(),
    result: { success: true, dryRun: true, summary: "Dry-run validation succeeded; no content was published.", request: requestForAudit },
  });
  await taskRepository.update(task.id, { status: "COMPLETED" });
  await eventRepository.create({
    type: "WORKFLOW_COMPLETED",
    message: `Execution succeeded (dry run) for task: ${task.title}`,
    metadata: { taskId: task.id, executionId: execution.id, toolKey: "blackos_api" },
    agency: { connect: { id: task.agencyId } },
  });
  return { status: "CREATED", execution: succeeded };
}

export interface N8nCallbackPayload {
  executionId: string;
  taskId: string;
  idempotencyKey: string;
  agencyId: string;
  success: boolean;
  summary?: string;
}

export type CallbackResult =
  | { status: "OK"; execution: Execution; alreadyProcessed: boolean }
  | { status: "NOT_FOUND" }
  | { status: "MISMATCH"; reason: string }
  | { status: "INVALID_TRANSITION"; reason: string };

/**
 * Handles the n8n → BlackOS callback. Looks the Execution up by
 * (taskId, idempotencyKey) — the caller-supplied executionId is only used as
 * a consistency check against that authoritative lookup, never trusted on
 * its own (see docs/execution-engine.md §8). Idempotent: a second identical
 * callback for an already-terminal Execution is a no-op that returns the
 * existing state rather than erroring or re-applying the transition.
 */
export async function handleN8nCallback(payload: N8nCallbackPayload): Promise<CallbackResult> {
  const execution = await executionRepository.findByTaskAndIdempotencyKey(payload.taskId, payload.idempotencyKey);
  if (!execution) return { status: "NOT_FOUND" };

  if (execution.id !== payload.executionId || execution.agencyId !== payload.agencyId) {
    return { status: "MISMATCH", reason: "Callback payload does not match the execution located by (taskId, idempotencyKey)." };
  }

  // Idempotent replay: already terminal — return the existing state, change nothing.
  if (execution.status === "SUCCEEDED" || execution.status === "FAILED") {
    return { status: "OK", execution, alreadyProcessed: true };
  }

  if (execution.status !== "AWAITING_CALLBACK") {
    return { status: "INVALID_TRANSITION", reason: `Execution is ${execution.status}, not AWAITING_CALLBACK — cannot apply a callback.` };
  }

  const nextStatus = payload.success ? "SUCCEEDED" : "FAILED";
  const updated = await executionRepository.update(execution.id, {
    status: nextStatus,
    finishedAt: new Date(),
    result: payload.success ? { success: true, summary: payload.summary ?? null } : Prisma.JsonNull,
    failureReason: payload.success ? null : (payload.summary ?? "n8n reported failure"),
  });

  const step = await executionStepRepository.findFirstForExecution(execution.id);
  if (step) {
    await executionStepRepository.update(step.id, {
      status: nextStatus === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
      output: { success: payload.success, summary: payload.summary ?? null },
      finishedAt: new Date(),
    });
  }

  await taskRepository.update(execution.taskId, { status: payload.success ? "COMPLETED" : "FAILED" });

  await eventRepository.create({
    type: payload.success ? "WORKFLOW_COMPLETED" : "WORKFLOW_FAILED",
    message: `Execution ${nextStatus.toLowerCase()} via n8n callback`,
    metadata: { taskId: execution.taskId, executionId: execution.id, toolKey: execution.toolKey },
    agency: { connect: { id: execution.agencyId } },
  });

  return { status: "OK", execution: updated, alreadyProcessed: false };
}
