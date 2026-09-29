import { assertCan } from "@/lib/permissions";
import { assembleContext, ContextAuthorizationError } from "@/context/contextService";
import { planJarvisRequest } from "@/jarvis/core";
import type { Actor, AgentDecision, AgentDefinition, AgentInput } from "./types";

/**
 * BlackOS Agent v0.1 — see docs/agent-engine.md.
 *
 * Code-defined registry — no Prisma model, no Neo4j node, no dynamic
 * registration. One Agent for v0.1: a deterministic operations task
 * planner. Adding a second Agent later means adding a second entry here,
 * not building a generic framework this phase was explicitly told to avoid.
 */
const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  operations_task_planner: {
    key: "operations_task_planner",
    name: "Operations Task Planner",
    description: "Given an objective and bounded context, determines whether it converts into a valid BlackOS Task proposal. Never executes, approves, or persists anything itself.",
    enabled: true,
  },
};

export class AgentUnavailableError extends Error {
  constructor(message = "This Agent is not available.") {
    super(message);
    this.name = "AgentUnavailableError";
  }
}

/** Returns the definition only — never used to grant authority by itself (see docs/agent-engine.md "Identity vs authority"). */
export function getAgentDefinition(agentKey: string): AgentDefinition | undefined {
  return AGENT_REGISTRY[agentKey];
}

/**
 * The sole entry point. Fail-closed order: (1) resolve the Agent definition
 * and confirm it's enabled, (2) confirm the real actor is permitted to
 * invoke an Agent at all, (3) only then read anything — via
 * assembleContext() and planJarvisRequest(), both already-vetted, already
 * agency-scoped functions. This module never imports Prisma, a repository,
 * neo4jClient, or n8nClient directly (see the static guard test in
 * src/agents/__tests__/run.ts).
 *
 * The actor is the sole authority for agency scope — there is no free-form
 * agencyId parameter, exactly mirroring assembleContext()'s own contract.
 */
export async function invokeAgent(agentKey: string, actor: Actor, input: AgentInput): Promise<AgentDecision> {
  const definition = getAgentDefinition(agentKey);
  if (!definition || !definition.enabled) {
    throw new AgentUnavailableError();
  }

  assertCan(actor.role, "automatisations");

  // Fail closed on a Super Admin's cross-agency (null) session before doing
  // any read — assembleContext() would throw the same ContextAuthorizationError
  // internally, but checking here too narrows actor.agencyId to `string` for
  // the planJarvisRequest() call below without an unsafe cast.
  if (!actor.agencyId) {
    throw new ContextAuthorizationError();
  }

  const context = await assembleContext(actor, { entity: input.entity, capabilityKey: input.capabilityKey });

  // Deterministic dedup judgment — the one piece of reasoning this Agent
  // actually adds beyond calling planJarvisRequest() directly: if an
  // active Task already covers the same capability for the same entity,
  // proposing a duplicate would be noise, not help. This is read-only
  // judgment over already-bounded Context; it never blocks anything, it
  // only declines to propose a redundant duplicate.
  if (input.capabilityKey) {
    const duplicate = context.activeTasks.find((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
    if (duplicate && context.entity) {
      return { type: "NO_ACTION", reason: `An active task (${duplicate.id}) already exists for this entity; not proposing a duplicate.` };
    }
  }

  // planJarvisRequest() is Jarvis Core's own, already-tested intent/entity/
  // graph/risk resolution — reused, not re-implemented, so this Agent
  // cannot silently diverge from Jarvis Core's resolution logic (the exact
  // "Agent becomes a second Jarvis Core" duplication this module must
  // avoid is prevented by calling the real function, not reimplementing
  // its behavior).
  const plan = await planJarvisRequest({
    message: input.objective,
    agencyId: actor.agencyId,
    actorId: actor.id,
    source: "internal",
  });

  if (plan.status === "DRY_RUN") {
    return { type: "PROPOSE_TASK", plan, reason: "Objective resolved to a complete, actionable plan." };
  }
  if (plan.status === "NEEDS_CLARIFICATION") {
    return { type: "NEEDS_CLARIFICATION", reason: plan.reason ?? "The objective is ambiguous or incomplete." };
  }
  // UNKNOWN_INTENT — no matching capability at all, nothing actionable here.
  return { type: "NO_ACTION", reason: plan.reason ?? "No actionable capability matched this objective." };
}
