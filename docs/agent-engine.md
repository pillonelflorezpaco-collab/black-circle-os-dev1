# BlackOS Agent v0.1

**An Agent proposes; it never decides authoritatively, approves, or executes.**

## Purpose

The first real Agent: `operations_task_planner`. Given an authenticated
actor, an objective, and optional entity/capability hints, it determines
whether the objective converts into a valid Task proposal — nothing more.

## What an Agent is

`invokeAgent(agentKey, actor, input) → AgentDecision` — a stateless function,
invoked fresh per call. No persistent process, no background loop, no
schedule. See `src/agents/agentService.ts`.

## What an Agent is not

Not Jarvis Core (it *calls* `planJarvisRequest()`, never re-implements
intent/entity/graph resolution itself — duplicating that logic inside the
Agent would recreate exactly the "second Jarvis Core" this design avoids).
Not the Orchestrator (it never sequences Task→Approval→Execution itself —
that remains the caller's job, via the existing Orchestrator, after the
Agent's proposal is accepted). Not the Task/Approval/Execution Engine (it
never calls `createTaskFromJarvisPlan`, `approveApproval`, `rejectApproval`,
or `createExecutionForTask` — confirmed by a static source guard in
`src/agents/__tests__/run.ts`).

## Identity vs authority

**Identity:** a code-defined registry entry (`AGENT_REGISTRY` in
`agentService.ts`) — `{ key, name, description, enabled }`. No Prisma model,
no Neo4j node, no dynamic registration; one entry is enough for v0.1. The
Agent's *existence in the registry* (`getAgentDefinition()`) grants no
authority by itself — invoking it still requires the real actor to pass the
permission check below. This deliberately does not carry an "allowed
objective scope" field: `planJarvisRequest()`'s own intent/capability
resolution already gates what's resolvable — a second scope list on top of
it would duplicate, not add, a boundary.

**Note on naming collision:** Neo4j already has `Agent` graph nodes
(`jarvis`, `marketing_manager`) — those are organizational role references,
a completely different concept from this software Agent. Neither this
module nor its tests touch those Neo4j nodes.

## Agency and actor

The actor is the sole authority — no free-form `agencyId` parameter,
mirroring `assembleContext()`'s own contract exactly (`src/agents/types.ts`
re-exports the same `Actor` type from `@/context/types`, no fourth
duplicate copy). A Super Admin's cross-agency session (`actor.agencyId ===
null`) is rejected before any read, via the same `ContextAuthorizationError`
Context Engine already defines. The Agent never fabricates or substitutes
an actor — it forwards exactly the one it was given into `assembleContext()`
and `planJarvisRequest()`.

## Permissions

Reuses the existing `automatisations` permission (`src/lib/permissions.ts`)
— no new permission was added. `automatisations` already gates
Jarvis/orchestration-adjacent capability for `SUPER_ADMIN`, `OWNER`,
`AGENCY_MANAGER`, and `DEVELOPER`, and is already `false` for
content-production-only roles — a genuine existing semantic match for "may
invoke an Agent," not a repurposed unrelated permission. **Invoking the
Agent is not permission to execute its proposal** — the resulting
`PROPOSE_TASK` plan still passes through the unmodified, independently
permission-checked Task → Approval → Execution pipeline.

## Context

The Agent's only application-data access path is `assembleContext()`
(`@/context/contextService`) — it never imports `@/lib/prisma`, a
repository, `neo4jClient`, or `n8nClient` (verified by a static source-grep
test). It reuses the existing `ContextBundle` as-is; no second,
Agent-specific context shape was introduced, since nothing so far has
proven `ContextBundle` insufficient.

## Reasoning (v0.1: deterministic, no LLM)

1. Resolve the Agent definition; deny if unknown or disabled
   (`AgentUnavailableError`).
2. `assertCan(actor.role, "automatisations")`.
3. Fail closed if `actor.agencyId` is null.
4. `assembleContext(actor, { entity, capabilityKey })`.
5. If a capability was given and an active (non-`COMPLETED`/`CANCELLED`)
   Task already exists in the returned `activeTasks` for the same entity —
   decline as `NO_ACTION` rather than propose a duplicate. This is the one
   piece of reasoning genuinely specific to this Agent, beyond what calling
   `planJarvisRequest()` alone would provide.
6. `planJarvisRequest({ message: objective, agencyId, actorId, source: "internal" })`
   — Jarvis Core's own, already-tested resolution, reused unmodified.
7. Map the plan's status to the Agent's own closed decision set:
   `DRY_RUN → PROPOSE_TASK`, `NEEDS_CLARIFICATION → NEEDS_CLARIFICATION`,
   `UNKNOWN_INTENT → NO_ACTION`.

No LLM, no external model call — deliberately deferred (see
`docs/agent-engine.md`'s own non-goals below and the prior Agent
Architecture Audit).

## Decision contract

A closed union — exactly three outcomes, nothing else:
```
{ type: "NO_ACTION"; reason }
{ type: "NEEDS_CLARIFICATION"; reason }
{ type: "PROPOSE_TASK"; plan: JarvisPlan; reason }
```
`PROPOSE_TASK` carries a real `JarvisPlan` — the exact shape
`createTaskFromJarvisPlan()` already consumes. **`invokeAgent()` never calls
`createTaskFromJarvisPlan()` itself** — producing the plan is the entire
extent of its authority; persisting it (and evaluating approval) remains
the caller's job via the existing, unmodified pipeline.

## Task / Approval / Execution boundary

```
Agent → PROPOSE_TASK (a JarvisPlan)
      → caller invokes the existing createTaskFromJarvisPlan() / Orchestrator
      → existing risk evaluation → Approval if required (unmodified)
      → Orchestrator → Execution Engine → n8n (unmodified)
```
The Agent has no code path to `Approval.status` or to
`createExecutionForTask()` — confirmed by static guard tests. It cannot
self-approve, cannot bypass approval, and cannot trigger execution.

## Memory

Not implemented, not needed for v0.1. Every piece of information this
Agent's reasoning uses is already available through Context
(`activeTasks`, the resolved entity, the organizational graph) — confirmed
by this implementation actually working without any Memory access. If a
future need for durable, non-derivable information emerges (e.g., "this
Model has needed manual TikTok re-approval three times before, across
sessions"), that remains a distinct, separately-authorized Memory design
question — not solved here.

## Security invariants

Fail-closed order (definition check → permission → agency-null check →
reads); no direct Prisma/repository/Neo4j/n8n access; no Approval mutation;
no Execution invocation; no synthetic actor; deterministic output for
identical input; bounded reads (inherited entirely from `assembleContext`'s
own limits — the Agent adds no additional unbounded query).

## Non-goals (v0.1)

No LLM/provider integration. No Memory. No multi-Agent orchestration
(exactly one Agent exists). No autonomy levels (this Agent only ever
proposes — Level "Recommend" in the prior audit's framing, never higher).
No Business Tools system (the Agent's only "tool" is proposing a Task via
the existing, already-gated capability/tool resolution). No new permission
matrix entry. No HTTP endpoint.
