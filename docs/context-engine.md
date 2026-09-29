# Jarvis Context Engine v0.1f

**The Context Engine informs decisions; it does not authorize or execute them.**

## Purpose

A read-only assembly layer that composes already-authoritative Postgres
information (and, optionally, the Neo4j organizational graph) into one
`ContextBundle` — for future Jarvis planning and future Agents, so they
don't each reinvent ad hoc, unbounded, unscoped queries.

## Scope

One function: `assembleContext(actor, opts?)` (`src/context/contextService.ts`).
It stores nothing, creates nothing, infers nothing, approves nothing,
executes nothing, and calls neither n8n nor a Neo4j write session. See
docs/task-engine.md, docs/approval-engine.md, docs/execution-engine.md,
docs/orchestrator.md for the systems that remain authoritative for their
own domains — this document only covers what changed to make their data
observable in one bounded read.

## ContextBundle

```
{
  agency: { id, name }
  actor: { id, role, agencyId }
  entity?: { type: "model", id, name }
  activeTasks: TaskSummary[]        // status IN (READY, IN_PROGRESS, WAITING_APPROVAL)
  recentApprovals: ApprovalSummary[]
  recentExecutions: ExecutionSummary[]
  recentEvents: EventSummary[]
  organization?: GraphResolution     // reused verbatim from graphResolver.ts
  errors?: { organization?: string }
}
```

Every summary type is a narrow projection (see `src/context/types.ts`) —
never the full Prisma row. Explicitly excluded: `Task.objective`,
`Approval.reason`/`decisionNote`, `Execution.result`/`failureReason`,
`Event.metadata` — none of these are needed for the target "what is
happening" question, and all of them could carry more business detail than
a bounded context read should return wholesale.

## Authorization

The actor is the sole authority — there is no free-form `agencyId`
parameter. `assembleContext` fails closed (throws `ContextAuthorizationError`)
if `actor.agencyId` is null — a Super Admin session must resolve an acting
agency (`getEffectiveAgencyId()`) before calling this function, exactly as
the Command Center already does for its own reads. This reuses the actor
shape already independently defined in `approvalService.ts`/
`executionService.ts`/`orchestratorService.ts` — no shared export existed
to import without modifying those files (out of scope for v0.1f), so
`src/context/types.ts` defines an identical local copy, consistent with the
existing precedent of each module defining its own.

## Entity boundary

The only supported entity type is `model` (`Model.id`/`Model.name`) —
`Task.entityId`/`entityType` already only ever populate `"MODEL"`. No
`Client`/`Project`/`Campaign`/`Brand` exists in the schema; none is added
speculatively.

**Cross-agency existence is never leaked:** a `Model` that doesn't exist and
a `Model` that exists in a different agency both resolve to
`entity: undefined` — a caller cannot distinguish the two.

## Postgres / Neo4j precedence

**Postgres is operational truth. Neo4j is informational organizational
context only.** If `organization.tools` says a capability normally uses
`n8n`, and no valid `Task`/`Execution` exists in Postgres, the bundle
reports both facts separately — it never merges them into an implied
"therefore execution is allowed." Nothing in `contextService.ts` writes
Neo4j; `resolveCapabilityContext()` (`graphResolver.ts`) is reused verbatim,
unmodified.

## Current vs historical

`agency`, `actor`, `entity`, and `organization` are read fresh on every
call — current. `activeTasks` reflects live `Task.status`, but each row's
other fields are historical plan snapshots (same as everywhere else this
data is read). `recentApprovals`/`recentExecutions`/`recentEvents` are
explicitly historical — a past `APPROVED` approval or a past successful
execution appearing in context **never** implies current authorization;
only the live `Approval.status`/`Task.status` rows the Execution Engine
itself re-checks can do that.

## Bounded limits

`activeTasks: 10`, `recentApprovals: 10`, `recentExecutions: 10`,
`recentEvents: 20` — no field is ever unbounded. Approvals/executions are
scoped to the entity's own active task ids (never an unbounded agency-wide
scan) — if no entity is provided, or the entity has no active tasks,
`activeTasks`/`recentApprovals`/`recentExecutions` are all `[]`.

## Failure behavior

| Scenario | Behavior |
|---|---|
| Model not found / in another agency | `entity: undefined`, bundle continues |
| No active tasks / approvals / executions / events | `[]`, not an error |
| Neo4j unavailable or capability unresolvable | `organization: undefined` + `errors.organization` (sanitized, no driver details) |
| Actor's own agency fails to resolve in Postgres | hard failure (throws) |
| `actor.agencyId` is null | hard failure (`ContextAuthorizationError`), before any read runs |

## Security invariants

No Prisma `create`/`update`/`delete`/`upsert` call exists in
`contextService.ts` (verified by a static source-grep test). No import of
`n8nClient` or a raw Neo4j write client. No call to
`startOrchestration`/`resumeOrchestration`/`createExecutionForTask`/
`createTaskFromJarvisPlan`/`approveApproval`/`rejectApproval`. Agency
isolation is enforced on every entity-scoped read. Context is never treated
as sufficient authorization anywhere it might be consumed — the historical
`Approval`/`Execution` summaries are inert data.

## Memory boundary

Context Engine = "assemble and return what already exists, authoritatively,
right now." A future Memory Engine = "durably store information that
*cannot* be derived from current operational records" (a stated preference,
a summarized decision pattern with no corresponding row). If a fact can be
produced by querying existing Postgres/Neo4j tables today, it belongs here,
never in a future Memory table.

## Explicit non-goals (v0.1f)

No HTTP endpoint. No AngelOS exposure (AngelOS does not exist in this
repository). No Agent framework. No vector database, embeddings, or RAG. No
generic Memory table. No new permission matrix entry — authorization is
entirely the reused `actor.agencyId` check.

## Future Agent consumption

`Agent → assembleContext() → bounded ContextBundle` — never
`Agent → Prisma` and never `Agent → Neo4j` directly. This module is the
intended seam for that, once Agents exist (not part of this phase).
