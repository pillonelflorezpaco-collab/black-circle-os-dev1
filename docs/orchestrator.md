# Jarvis Orchestrator v0.1a

## Purpose

Coordinates the existing Jarvis Core / Task Engine / Approval Engine /
Execution Engine into one sequenced call, so a caller no longer has to
manually chain `/api/engine/jarvis/request` and `/api/engine/executions/trigger`
and hold the intermediate state itself. It is a coordination layer, not a
new decision-making engine.

## Responsibility

- Accept an `OrchestrationRequest` (the existing `JarvisRequest` shape, plus
  a first-class optional `requestId`).
- Call `planJarvisRequest()`, `createTaskFromJarvisPlan()`,
  `createApprovalForTask()`, and (only when legitimately allowed —
  see "Execution boundary") `createExecutionForTask()`, in that order.
- Persist a thin `OrchestrationRecord` tracking which state that
  coordination has reached and which Task/Approval/Execution it produced.
- Provide requestId-scoped idempotency for the whole chain.

## Non-responsibility

- Does not resolve intent, entities, risk, department, agent, capability, or
  tools — `planJarvisRequest()` owns all of that, unchanged.
- Does not decide whether approval is required — `evaluateApprovalRequirement()`
  (via `createApprovalForTask()`) owns that, unchanged.
- Does not grant or deny approvals — see "Approval boundary" below.
- Does not call n8n directly, does not write to Neo4j, does not mutate
  Postgres outside its own `OrchestrationRecord` row (via
  `orchestration.repository.ts`) and the calls it makes into the existing
  engines' own repositories.
- Does not implement resume-from-storage (V0.1b) or an HTTP entry point —
  both are explicitly out of scope for v0.1a.

## State machine

```
REQUESTED → PLANNING → NEEDS_CLARIFICATION      (terminal — plan not DRY_RUN)
                     → FAILED                    (terminal — task/execution rejected)
                     → TASK_CREATED → AWAITING_APPROVAL → (human decision, outside this module)
                                    → EXECUTING → COMPLETED / FAILED
```

`UNDERSTANDING`/`CONTEXT_LOADING`/`PLANNING` are collapsed into a single
`PLANNING` state: `planJarvisRequest()` is one synchronous call with no
externally-observable pause between intent resolution and graph resolution,
so a three-way split would be fake granularity with no corresponding code
boundary. `JarvisPlan.steps` already carries the fine-grained trace inside
that one state.

**Known limitation (v0.1a):** `createApprovalForTask()` only transitions
`Task.status` to `READY` when an Approval was required and later approved
(`approveApproval()`). When approval is *not* required (LOW/MEDIUM risk),
nothing in the existing Task/Approval Engine code moves the Task past
`PLANNED`. Because `createExecutionForTask()` requires `Task.status ===
"READY"`, the Orchestrator's `EXECUTING` state is therefore **not reachable
today** from the non-approval path — a v0.1a orchestration for a LOW/MEDIUM
task correctly and honestly stops at `TASK_CREATED`. This is a pre-existing
Task Engine gap, not something introduced or worked around here; the
Orchestrator's execution hand-off code re-reads the real `Task.status`
before ever calling `createExecutionForTask()`, so it will start working
automatically if/when a future Task Engine change legitimately sets a
non-approval-required task to `READY` — no Orchestrator code change needed.

## Service boundaries

| Concern | Owner | Orchestrator's relationship |
|---|---|---|
| Intent/context/planning | `jarvis/core.ts` | calls, forwards result verbatim |
| Task persistence | `jarvis/taskService.ts` | calls, records `taskId` |
| Approval requirement + decision | `jarvis/approvalService.ts` | calls, records `approvalId`; never decides |
| Execution preconditions + n8n trigger | `execution/executionService.ts` | calls only when `Task.status === READY`; records `executionId` |
| Orchestration coordination state | `orchestrator/orchestratorService.ts` + `repositories/orchestration.repository.ts` | owns this and only this |

## Approval boundary (critical)

The Orchestrator contains **no code path** that sets `Approval.status` to
`APPROVED`. The only way an Approval becomes `APPROVED` is a human calling
`approveApproval()` — a separate, session-authed dashboard action, not
reachable from `orchestratorService.ts`. `startOrchestration()` treats the
mere existence of a `PENDING` Approval as a stop condition
(`AWAITING_APPROVAL`), never as permission to continue.

## Execution boundary

`createExecutionForTask()` is only ever called after re-reading the real
`Task.status` from Postgres and confirming it is `READY` — never inferred
from "approval was not required" or any other orchestrator-local reasoning.
`executionService.ts`'s own preconditions (permission, HIGH-risk-has-approval,
supported tool, idempotency) are unchanged and still the sole authority.

## Idempotency model

`OrchestrationRecord.requestId` is unique per `(agencyId, requestId)` — the
same structural pattern as `Task.requestId` and `Execution.idempotencyKey`.
A second `startOrchestration()` call with the same `requestId`:
- if the row is still `REQUESTED`, is resolved by an atomic
  `claimForPlanning()` compare-and-swap (`UPDATE ... WHERE state =
  'REQUESTED'`) so only one caller actually proceeds to create a Task, even
  under true concurrency — the unique constraint alone only prevents a
  second *row*, not two callers both processing the same still-REQUESTED row;
- if the row has already progressed, reuses it as-is without redoing work.

No second idempotency mechanism (locks, queues, application-level mutexes)
is introduced — this is the same database row and the same unique
constraint, used correctly under concurrency.

## Events

No new `SystemEventType` values were added. `TASK_CREATED` and
`TASK_APPROVAL_REQUESTED` are already emitted by the existing
`taskService.ts`/`approvalService.ts` calls the Orchestrator makes — they
already carry `taskId`/`approvalId` in `metadata`, which is sufficient to
correlate them back to an `OrchestrationRecord` by joining on `taskId`. A
dedicated `orchestrationId` metadata field or new event types were
considered and deliberately not added in v0.1a: nothing yet observes
orchestration-level events independently of the Task/Approval events that
already exist, so adding them now would be speculative. Revisit when the
Command Center orchestrator view (V0.2+) is built.

## Resume boundary (v0.1b)

`resumeOrchestration(orchestrationId, actor)` resumes an orchestration after
a human has already approved it through the existing Approval Engine
(`approveApproval()`, session-authed, outside this module entirely).

**Critical invariant:** `OrchestrationRecord.state` is never read to decide
whether execution is authorized. Every decision re-reads the real
`Approval.status` and `Task.status` at call time:
- an attached `executionId` is the only signal used to short-circuit to
  `ALREADY_RESUMED` — never the `state` label;
- if an `approvalId` was recorded, the real `Approval` row is fetched fresh
  and must be `APPROVED`, or the call returns `APPROVAL_PENDING`;
- the real `Task` row must be `READY`, or the call returns `TASK_NOT_READY`.

This function never sets `Approval.status`, never calls `approveApproval()`,
and only calls the existing `createExecutionForTask()` once both of the
above are satisfied. The resulting `OrchestrationState` is the smallest
accurate label (`COMPLETED`/`FAILED`/`EXECUTING`) derived from the real
`Execution.status` — never presumed `COMPLETED` merely because
`createExecutionForTask()` returned successfully.

Idempotency: `executionId` presence is the resume-level idempotency signal;
concurrent resume calls converge on exactly one `Execution` via the
Execution Engine's own `(taskId, idempotencyKey)` uniqueness — no additional
lock was introduced for resume.

## V0.1c — HTTP entry point

**Endpoint:** `POST /api/engine/orchestrator/request`

**Authentication:** the same Bearer/`EngineApiKey` mechanism as every other
`/api/engine/**` route (`verifyEngineApiKey`) — no second auth system. No
credentials or invalid credentials → `401`.

**Request shape** (mirrors `JarvisRequest` plus the first-class `requestId`
already introduced in v0.1a — no competing request model):
```json
{
  "message": "plan my content",
  "agencyId": "...",
  "actorId": "...",
  "source": "internal | telegram | engine",
  "requestId": "optional idempotency key",
  "metadata": {}
}
```

**Response shape** — a thin projection of `OrchestrationRecordView`, never a
raw Prisma object and never a nested Task/Approval/Execution body:
```json
{
  "orchestrationId": "...",
  "requestId": "...",
  "state": "TASK_CREATED",
  "taskId": "...",
  "approvalId": null,
  "executionId": null
}
```

**HTTP status mapping:**
| Status | Meaning |
|---|---|
| 200 | orchestration ran and produced a deterministic result — including `NEEDS_CLARIFICATION`/`FAILED` outcomes, which are still complete, non-error responses (same convention as the existing `/api/engine/jarvis/request` route) |
| 400 | malformed JSON, missing/invalid fields, or `actorId` not a real user |
| 401 | missing or invalid `EngineApiKey` |
| 403 | authenticated key's agency does not match the request's `agencyId`, or the resolved actor belongs to a different agency than the key |
| 500 | unexpected internal failure — response body is a fixed generic string, never `err.message` |

**Idempotency:** unchanged from v0.1a/b — `requestId` is the same
`(agencyId, requestId)`-unique key `startOrchestration()` already enforces.
The route introduces no second, HTTP-specific idempotency store.

**Approval boundary:** unchanged. The route only calls `startOrchestration()`
— it cannot approve, infer approval, or bypass `AWAITING_APPROVAL`.

**Execution boundary:** unchanged. The route has no execution authority; the
only path to n8n remains HTTP → `startOrchestration()` → Execution Engine →
n8n. The route never imports `n8nClient`, never calls Neo4j, and performs no
Prisma access beyond resolving the authenticated actor's real
`Role`/`agencyId` (the same single lookup `/api/engine/executions/trigger`
already performs, for the same reason: the request body's `actorId` role/
agency is never trusted on its own).

**The route is an adapter only:** authenticate → validate → authorize →
`startOrchestration()` → map result → respond. It does not call
`planJarvisRequest`/`createTaskFromJarvisPlan`/`createApprovalForTask`/
`createExecutionForTask` directly.

**Known deviation:** `EngineApiKey.scopes` exists in the schema but is not
enforced by this route, because no existing `/api/engine/**` route enforces
it either — introducing scope enforcement only here would be a new,
inconsistent authorization mechanism rather than a reuse of an established
one. This is a pre-existing gap across all engine routes, not introduced by
v0.1c.
