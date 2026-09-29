import { taskRepository } from "@/repositories/task.repository";
import { eventRepository } from "@/repositories/event.repository";
import type { Task } from "@prisma/client";
import type { JarvisPlan, JarvisRequest } from "./types";

export type CreateTaskResult = { status: "CREATED"; task: Task } | { status: "REJECTED"; reason: string };

function humanizeKey(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildTitle(plan: JarvisPlan): string {
  const capabilityLabel = plan.capability ? humanizeKey(plan.capability.key) : "Task";
  const entity = plan.entities?.[0];
  return entity ? `${capabilityLabel} — ${entity.name}` : capabilityLabel;
}

/**
 * Persists a Task from an already-resolved Jarvis orchestration plan.
 *
 * Deliberately does NOT re-derive intent/agent/capability/risk/entity — it
 * only transcribes what Jarvis Core already resolved (see docs/task-engine.md
 * §4). A plan that isn't a complete DRY_RUN is rejected outright; this
 * function never invents a missing value to make a task "work".
 *
 * Task Engine v0.1 boundary: every task this creates has
 * executionAllowed = false and status = PLANNED, regardless of risk level.
 * No execution of any kind happens here.
 */
export async function createTaskFromJarvisPlan(request: JarvisRequest, plan: JarvisPlan): Promise<CreateTaskResult> {
  if (plan.status !== "DRY_RUN") {
    return { status: "REJECTED", reason: `Cannot create a task from a non-DRY_RUN plan (status: ${plan.status}${plan.reason ? `, reason: ${plan.reason}` : ""}).` };
  }
  if (!plan.intent || !plan.department || !plan.agent || !plan.capability) {
    return { status: "REJECTED", reason: "Plan is missing required fields (intent/department/agent/capability)." };
  }

  // Idempotency (see docs/task-engine.md §13): only enforced when the caller
  // supplies a requestId. Without one, no dedup is attempted — this is a
  // documented limitation, not a "same title" heuristic.
  const requestId = typeof request.metadata?.requestId === "string" ? request.metadata.requestId : undefined;
  if (requestId) {
    const existing = await taskRepository.findByAgencyAndRequestId(request.agencyId, requestId);
    if (existing) {
      return { status: "CREATED", task: existing };
    }
  }

  const entity = plan.entities?.[0];

  const task = await taskRepository.create({
    agency: { connect: { id: request.agencyId } },
    title: buildTitle(plan),
    objective: request.message,
    status: "PLANNED",
    priority: "NORMAL",
    source: "JARVIS",
    agentKey: plan.agent.key,
    capabilityKey: plan.capability.key,
    departmentKey: plan.department.key,
    entityType: entity ? entity.type.toUpperCase() : null,
    entityId: entity?.id ?? null,
    riskLevel: plan.capability.riskLevel,
    executionAllowed: false,
    requestId: requestId ?? null,
  });

  // Uses the generic Event model (SystemEventType.TASK_CREATED) rather than
  // ActivityLogEntry — a task being planned is a machine-oriented system
  // event, not a human-facing dashboard feed item (see docs/task-engine.md §9).
  // No new event system introduced; TASK_CREATED was already anticipated in
  // the SystemEventType enum from the Device Infrastructure phase.
  await eventRepository.create({
    type: "TASK_CREATED",
    message: `Tâche planifiée par Jarvis : ${task.title}`,
    metadata: { taskId: task.id, agentKey: task.agentKey, capabilityKey: task.capabilityKey },
    agency: { connect: { id: request.agencyId } },
  });

  return { status: "CREATED", task };
}
