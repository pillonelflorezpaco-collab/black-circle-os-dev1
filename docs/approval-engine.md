# Approval Engine v0.1

**Records human decisions only. Does not execute approved work.** There is
no code path anywhere in this phase that reacts to `Approval.status =
APPROVED` by calling n8n, Telegram, a social API, or transitioning a Task
into `IN_PROGRESS`/`COMPLETED`.

## 1. Purpose

Answers one question for a just-created `PLANNED` Task: *does this need a
human decision before it could eventually be executed?* Nothing more — it
does not decide execution order, does not notify anyone (yet), and does not
touch anything outside Postgres.

## 2. Risk policy

Centralized in one pure module, `src/jarvis/approvalPolicy.ts` —
`evaluateApprovalRequirement(riskLevel)`:

| Risk | `approvalRequired` | Note |
|---|---|---|
| `LOW` | `false` | may be automatic in a future execution phase |
| `MEDIUM` | `false` | a future notification-only step is anticipated, not implemented |
| `HIGH` | `true` | requires explicit human approval |

This is the only place this mapping exists — not duplicated in the API
route, the task service, or the approval service. Risk level itself still
comes from Neo4j at Jarvis Core planning time (`docs/jarvis-core.md`); this
module only decides what to *do* with a risk level already resolved
elsewhere.

## 3. Approval lifecycle

```
PENDING → APPROVED
        → REJECTED
        → CANCELLED (unused in v0.1)
        → EXPIRED   (unused in v0.1)
```

Every Approval starts `PENDING`. Nothing auto-approves.

## 4. Task integration

`src/app/api/engine/jarvis/request/route.ts`, `mode: "CREATE_TASK"`:

```
Jarvis Core → Task Engine (creates Task, always PLANNED) →
Approval Engine (createApprovalForTask) →
  LOW/MEDIUM → Task stays PLANNED, no Approval row
  HIGH       → Task → WAITING_APPROVAL, one PENDING Approval created
```

`TaskStatus.WAITING_APPROVAL` already existed in the Task Engine v0.1 enum —
this phase is the first to actually set it. No new Task states were added.

## 5. Authorization

Fine-grained Neo4j `HAS_ACCESS` permissions remain **not implemented**
(`/opt/neo4j/README.md` §9) — not invented here either. Approve/reject use
the existing coarse Postgres role system: a new permission,
`approuverTaches`, added to `src/lib/permissions.ts`'s existing matrix,
granted to `SUPER_ADMIN`, `OWNER`, and `AGENCY_MANAGER` only (the same
conservative tier as `gererEquipe`) — no new Role was invented. Agency
scoping reuses the existing `assertSameAgency` helper; a `SUPER_ADMIN`
(agency-less session) is exempt, exactly as elsewhere in the app.

## 6. Idempotency

**Database-enforced**, not application-only check-then-insert: a partial
unique index, `Approval_task_pending_unique` (`CREATE UNIQUE INDEX ...
ON "Approval"("taskId") WHERE status = 'PENDING'`), guarantees a task can
never have two simultaneous `PENDING` approvals. Prisma's schema language
has no native partial-unique-index syntax, so this one statement was added
by hand to the generated migration before applying it (see the migration's
`.sql` file). `createApprovalForTask` also checks for an existing `PENDING`
approval first (fast path) and catches the constraint violation (`P2002`) on
a concurrent race, returning the existing row either way — never erroring
the caller, never creating a duplicate.

## 7. Approval statuses

`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`. Only `PENDING`,
`APPROVED`, `REJECTED` are produced by v0.1 code. `CANCELLED`/`EXPIRED` exist
for a future phase (e.g. cancelling a stale pending approval, or an
approval that timed out) — no code sets them yet.

## 8. API endpoints

- `POST /api/approvals/[id]/approve` — body: `{ decisionNote?: string }`
- `POST /api/approvals/[id]/reject` — body: `{ reason: string }`

**Deliberately session-authed** (`auth()`, the same pattern as
`/api/videos/[id]/stage`), **not** placed under `/api/engine/**` as the task
brief first suggested. Reason: approving/rejecting requires a concrete human
`User` identity for `decidedBy` — an `EngineApiKey` represents an
agency-scoped machine caller with no specific human behind it, so it's the
wrong auth primitive for a decision that must be attributable to a person.
This is the "existing architecture suggests another route structure, use
that and document it" case the task anticipated.

`Task` creation/planning stays under `/api/engine/jarvis/request`
(`EngineApiKey`-authed, machine-callable) exactly as before — only the human
decision step uses session auth.

## 9. Execution boundary

- `approveApproval()` sets `Approval.status = APPROVED` and `Task.status =
  READY` — explicitly **not** `IN_PROGRESS`/`COMPLETED`. `READY` means only
  "no longer blocked on a human decision"; nothing currently reads that
  status to act on it.
- `rejectApproval()` sets `Approval.status = REJECTED` and `Task.status =
  CANCELLED` — the existing enum's terminal "will not proceed" state, chosen
  over inventing a new status since a rejected task and a cancelled task
  mean the same thing operationally.
- Both paths leave `Task.executionAllowed = false` untouched — this field is
  still only ever set by `src/jarvis/executionPolicy.ts` at Task creation
  time and nothing in this phase changes it.
- A static regression test (`src/jarvis/__tests__/run.ts`) greps
  `approvalService.ts`'s own source for execution-shaped calls
  (`sendTelegramMessage`, `fetch(`, `axios`, `n8n.`, etc.) and asserts none
  are present.

## 10. Future Execution Engine

A later phase would read a Task in `READY`, resolve its `capabilityKey` →
Tool via Neo4j (`src/jarvis/graphResolver.ts` already does this), and
actually trigger the corresponding n8n workflow — only then would
`executionAllowed` legitimately become `true`. Does not exist yet.

## 11. Future notifications

`MEDIUM` risk is documented as "notification, not approval" in the original
Jarvis architecture. No notification channel (Telegram, email) is wired to
approval events yet — `TASK_APPROVAL_REQUESTED`/`TASK_APPROVED`/
`TASK_REJECTED` Events are recorded for a future consumer to read, but
nothing currently pushes them anywhere.

## 12. Future Neo4j fine-grained permissions

Once `HAS_ACCESS` edges are seeded (still pending the confirmation requested
in `/opt/neo4j/README.md` §9), approval authorization could move from "any
`OWNER`/`AGENCY_MANAGER` in the agency" to "specifically the person/role the
graph grants approval rights over this department/capability." The coarse
check implemented now is intentionally a placeholder for that, not a
permanent design.

## Events

`SystemEventType` gained three values: `TASK_APPROVAL_REQUESTED`,
`TASK_APPROVED`, `TASK_REJECTED` — each written once, at the actual state
change, via the existing generic `Event` model (no new event system). No
event is written for a plan/evaluation that doesn't require approval
(`LOW`/`MEDIUM`) — only meaningful state changes are recorded.
