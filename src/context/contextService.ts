import { prisma } from "@/lib/prisma";
import { eventRepository } from "@/repositories/event.repository";
import { resolveCapabilityContext } from "@/jarvis/graphResolver";
import type { Actor, AssembleContextOptions, ContextBundle, ContextEntity, TaskSummary, ApprovalSummary, ExecutionSummary, EventSummary } from "./types";

const ACTIVE_TASK_STATUSES = ["READY", "IN_PROGRESS", "WAITING_APPROVAL"] as const;

const MAX_ACTIVE_TASKS = 10;
const MAX_RECENT_APPROVALS = 10;
const MAX_RECENT_EXECUTIONS = 10;
const MAX_RECENT_EVENTS = 20;

export class ContextAuthorizationError extends Error {
  constructor(message = "Actor is not authorized to assemble context.") {
    super(message);
    this.name = "ContextAuthorizationError";
  }
}

/**
 * Jarvis Context Engine v0.1f — see docs/context-engine.md.
 *
 * Read-only assembly of already-authoritative Postgres/Neo4j information
 * into one ContextBundle. Never stores anything, never infers anything,
 * never authorizes anything — see docs/context-engine.md "Context cannot
 * authorize" and "No mutation" for the invariants this function preserves.
 *
 * The actor is the sole authority for agency scope: there is no free-form
 * agencyId parameter. A Super Admin session (actor.agencyId === null) has
 * no single agency to scope context to and is rejected — the caller must
 * resolve an acting agency (e.g. via getEffectiveAgencyId()) before calling
 * this function, exactly as the Command Center already does for its own
 * reads.
 */
export async function assembleContext(actor: Actor, opts: AssembleContextOptions = {}): Promise<ContextBundle> {
  if (!actor.id || !actor.agencyId) {
    throw new ContextAuthorizationError();
  }
  const agencyId = actor.agencyId;

  // Independent reads — none depends on another's result.
  const [agency, entity, organizationResult, recentEvents] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true, name: true } }),
    resolveEntity(agencyId, opts.entity),
    resolveOrganization(opts.capabilityKey),
    eventRepository.findMany(agencyId, MAX_RECENT_EVENTS).then(toEventSummaries),
  ]);

  if (!agency) {
    // Postgres failure to resolve the actor's own agency — hard failure,
    // never a partial bundle (see docs/context-engine.md "Failure behavior").
    throw new Error(`Agency ${agencyId} could not be resolved.`);
  }

  // Entity-scoped reads depend on which Task rows the entity actually has,
  // so they run after entity resolution — a real dependency, not a forced
  // sequential chain (see docs/context-engine.md "Performance strategy").
  const activeTasks = entity ? await findActiveTasksForEntity(agencyId, entity.id) : [];
  const taskIds = activeTasks.map((t) => t.id);

  const [recentApprovals, recentExecutions] = taskIds.length
    ? await Promise.all([findRecentApprovals(taskIds), findRecentExecutions(taskIds)])
    : [[], []];

  const bundle: ContextBundle = {
    agency,
    actor: { id: actor.id, role: actor.role, agencyId: actor.agencyId },
    entity,
    activeTasks,
    recentApprovals,
    recentExecutions,
    recentEvents,
  };

  if (organizationResult.organization) {
    bundle.organization = organizationResult.organization;
  }
  if (organizationResult.error) {
    bundle.errors = { organization: organizationResult.error };
  }

  return bundle;
}

async function resolveEntity(agencyId: string, ref?: { type: "model"; id: string }): Promise<ContextEntity | undefined> {
  if (!ref) return undefined;

  const model = await prisma.model.findUnique({ where: { id: ref.id }, select: { id: true, name: true, agencyId: true } });

  // Model not found, or found but belongs to another agency — both cases
  // return the same result so a caller can never distinguish "doesn't
  // exist" from "exists in another agency" (see docs/context-engine.md
  // "Entity boundary" — no cross-agency existence leak).
  if (!model || model.agencyId !== agencyId) return undefined;

  return { type: "model", id: model.id, name: model.name };
}

async function resolveOrganization(capabilityKey?: AssembleContextOptions["capabilityKey"]): Promise<{ organization?: import("./types").ContextOrganization; error?: string }> {
  if (!capabilityKey) return {};

  try {
    const graph = await resolveCapabilityContext(capabilityKey);
    if (!graph) return { error: "Capability not found in the organizational graph." };
    return { organization: graph };
  } catch {
    // Never expose a raw driver error, connection string, or stack trace —
    // see docs/context-engine.md "Failure behavior" / "Observability".
    return { error: "Organizational graph is currently unavailable." };
  }
}

async function findActiveTasksForEntity(agencyId: string, entityId: string): Promise<TaskSummary[]> {
  const tasks = await prisma.task.findMany({
    where: { agencyId, entityType: "MODEL", entityId, status: { in: [...ACTIVE_TASK_STATUSES] } },
    orderBy: { updatedAt: "desc" },
    take: MAX_ACTIVE_TASKS,
    select: { id: true, title: true, status: true, riskLevel: true, createdAt: true, updatedAt: true },
  });
  return tasks;
}

async function findRecentApprovals(taskIds: string[]): Promise<ApprovalSummary[]> {
  return prisma.approval.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECENT_APPROVALS,
    select: { id: true, taskId: true, status: true, riskLevel: true, createdAt: true, decidedAt: true },
  });
}

async function findRecentExecutions(taskIds: string[]): Promise<ExecutionSummary[]> {
  return prisma.execution.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECENT_EXECUTIONS,
    select: { id: true, taskId: true, status: true, toolKey: true, createdAt: true, finishedAt: true },
  });
}

function toEventSummaries(events: Array<{ id: string; type: string; message: string | null; createdAt: Date }>): EventSummary[] {
  return events.map((e) => ({ id: e.id, type: e.type as EventSummary["type"], message: e.message, createdAt: e.createdAt }));
}
