// BlackOS Agent v0.1 — see docs/agent-engine.md.
//
// An Agent is a bounded reasoning function: (actor, objective, bounded
// Context) → one deterministic decision from a closed set. It never decides
// authoritatively, never executes, never mutates anything — see
// docs/agent-engine.md "What an Agent is not."

import type { JarvisPlan } from "@/jarvis/types";
import type { ContextEntityRef, AssembleContextOptions } from "@/context/types";

export type { Actor } from "@/context/types";

/** What the caller asks the Agent to consider. Reuses ContextEntityRef/capabilityKey exactly as assembleContext() already defines them — no competing shape. */
export interface AgentInput {
  objective: string;
  entity?: ContextEntityRef;
  capabilityKey?: AssembleContextOptions["capabilityKey"];
}

/**
 * The Agent's entire output surface — a closed union of exactly three
 * outcomes, per the approved v0.1 scope. PROPOSE_TASK carries a real
 * JarvisPlan (the same shape createTaskFromJarvisPlan() already consumes)
 * — never a parallel task model. The Agent never calls
 * createTaskFromJarvisPlan() itself; producing this decision is the entire
 * extent of its authority.
 */
export type AgentDecision =
  | { type: "NO_ACTION"; reason: string }
  | { type: "NEEDS_CLARIFICATION"; reason: string }
  | { type: "PROPOSE_TASK"; plan: JarvisPlan; reason: string };

/** A code-defined registry entry — no Prisma model, no Neo4j node, no dynamic registration. See docs/agent-engine.md "Agent identity." */
export interface AgentDefinition {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}
