# Task Engine v0.1

**Planning/persistence only. No execution of any kind.** Every task this
engine creates has `executionAllowed = false`, unconditionally, regardless
of risk level. There is no code path in this phase that flips it to `true`.

## 1. Purpose

Gives Jarvis a persistent representation of work: a Task Engine call takes an
already-resolved Jarvis Core orchestration plan and turns it into a durable
Postgres row, so work can be tracked, listed, and (in a later phase) actually
executed — without building execution now.

## 2. Task lifecycle

```
PLANNED → READY → IN_PROGRESS → COMPLETED
                              ↘ BLOCKED / WAITING_APPROVAL / FAILED / CANCELLED
```

`TaskStatus` enum has all 8 values so a future execution phase needs no
migration, but **Jarvis may only ever create `PLANNED`** in this phase — no
code transitions a task out of `PLANNED`.

## 3. Task fields

| Field | Notes |
|---|---|
| `id`, `agencyId`, `createdAt`, `updatedAt` | standard, agency-scoped like every other business table |
| `title`, `objective` | `title` is derived from the capability + entity name; `objective` is the original request message, verbatim |
| `status` | `TaskStatus`, default `PLANNED` |
| `priority` | `TaskPriority` (`LOW/NORMAL/HIGH/URGENT`), default `NORMAL` — no scoring logic |
| `source` | `TaskSource` (`JARVIS/HUMAN/SYSTEM`) — always `JARVIS` from this engine |
| `agentKey`, `capabilityKey`, `departmentKey` | **stable Neo4j keys**, plain strings — not foreign keys (see §5) |
| `entityType`, `entityId` | generic entity context, e.g. `MODEL` / a real `Model.id` (see §6) |
| `riskLevel` | copied from the Jarvis plan at creation time (`LOW/MEDIUM/HIGH`, stored as plain text) — Neo4j remains the source of truth for what the risk *should* be; this is a snapshot |
| `executionAllowed` | always `false` in this phase |
| `parentTaskId` | nullable self-relation (see §7) |
| `requestId` | nullable, unique per agency when present (see §9) |

## 4. Jarvis relationship

```
Jarvis Core (src/jarvis/core.ts)
   → JarvisPlan (pure data, no side effects)
      → taskService.createTaskFromJarvisPlan(request, plan)
         → Task (Postgres)
```

The Task service **never re-derives** intent, entity, agent, capability, or
risk — it only transcribes fields already present on a `DRY_RUN` plan. A
plan that is not a complete `DRY_RUN` (missing intent/department/agent/
capability, or any non-`DRY_RUN` status) is rejected outright — see
`src/jarvis/taskService.ts`. This is deliberate: Task Engine has zero
decision-making authority, so it can never create a task Jarvis Core didn't
actually resolve.

## 5. Neo4j relationship

Departments, Agents, and Capabilities continue to live only in Neo4j
(`/opt/neo4j/README.md`). The Task table stores their **stable keys**
(`agentKey`, `capabilityKey`, `departmentKey`) as plain strings — never a
Postgres foreign key, never a duplicated copy of the graph node. To resolve
"which agent is `marketing_manager`", a future consumer queries Neo4j by
that key; Postgres only remembers which key was assigned at planning time.

## 6. Entity references

`entityType` / `entityId` — a plain string pair, not a polymorphic Prisma
relation. In this phase, `MODEL` is the only entityType actually produced
(from `src/jarvis/entityResolver.ts`). The schema comment documents that
future types (`SOCIAL_ACCOUNT`, `POST`, `VIDEO`, `USER`, `CAMPAIGN`,
`DEVICE`) are anticipated but not implemented — no code resolves them yet.

## 7. Parent/child design

`parentTaskId` (nullable, self-relation `TaskChildren`) exists so a future
decomposition phase (e.g. "Create marketing campaign" → several child tasks)
needs no migration. **Nothing in v0.1 sets it** — every task created today
has `parentTaskId: null`. No automatic decomposition logic exists.

## 8. PLAN vs CREATE_TASK

`POST /api/engine/jarvis/request` takes an optional `mode` field:

- `mode: "PLAN"` (default) — returns `{ status, plan, task: null }`. Never touches the `Task` table, regardless of how the plan resolves.
- `mode: "CREATE_TASK"` — runs the identical Jarvis Core resolution; if (and only if) the result is a complete `DRY_RUN` plan, persists one `Task` and returns `{ status: "TASK_CREATED", plan, task, execution: { allowed: false } }`. If the plan is `NEEDS_CLARIFICATION`/`UNKNOWN_INTENT`, no task is created and the response mirrors the PLAN-mode shape with that actual status.

Both modes reuse the same `EngineApiKey` Bearer auth and agency scoping as
every other `/api/engine/**` route — no second auth mechanism, no path that
lets a caller supply `agentKey`/`capabilityKey`/`riskLevel` directly and
bypass Jarvis Core's resolution.

## 9. Execution boundary

`src/jarvis/executionPolicy.ts` is the single place `executionAllowed` and
`approvalRequired` are decided — both hardcoded `false`. Nothing else in the
codebase sets these fields. This phase does not call n8n, does not send
Telegram, does not touch social APIs, models, accounts, or devices.

## 10. Future approval integration

`TaskStatus.WAITING_APPROVAL` already exists in the enum. A future approval
phase would: read `riskLevel` off the task, and for `MEDIUM`/`HIGH`, hold the
task in `WAITING_APPROVAL` instead of transitioning it toward execution,
mirroring the risk semantics already documented in `docs/jarvis-core.md`.
Not implemented here.

## 11. Future n8n integration

A later execution phase would read a `Task` in `READY`, resolve its
`capabilityKey` → Tool via Neo4j (already possible via
`src/jarvis/graphResolver.ts`), and trigger the corresponding n8n workflow —
only then would `executionAllowed` legitimately become `true` for that task
type. No such trigger exists yet.

## 12. Future agent execution

Eventually a departmental agent (e.g. Marketing Manager) would be the thing
that actually picks up a `PLANNED`/`READY` task assigned to its `agentKey`
and works it. No agent runtime exists yet — `agentKey` today is purely a
label copied from the plan.

## 13. Idempotency considerations

`Task.requestId` is nullable with a `@@unique([agencyId, requestId])`
constraint. **This only provides real deduplication when a caller supplies a
`requestId`** (via `metadata.requestId` in the Jarvis request) — if omitted,
no dedup is attempted at all. This is an intentional, documented limitation
for v0.1 rather than a fragile "same title = same task" heuristic: a title
is human-facing and not a safe identity key (two genuinely different
requests can produce the same title). A future phase should decide how
`requestId` is actually generated/propagated by callers (Telegram message
id, n8n execution id, etc.) before relying on this for real deduplication.

## Explicitly out of scope for v0.1

Telegram, real n8n execution, Graphiti, autonomous LLM reasoning, real
approvals, real fine-grained Neo4j permissions, social publishing, device
automation, a BlackOS frontend for tasks.
