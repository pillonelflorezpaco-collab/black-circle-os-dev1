# Social Media Execution v0.1 — `social_media_management` via Blotato

**Dry-run only. No real content is published by this phase.**

## Purpose

Activates the previously-dormant `social_media_management` capability
(already live in Neo4j: `marketing_manager` → `marketing_agency` →
`blackos_api`) by connecting it to the already-existing, previously
zero-caller Blotato posting infrastructure (`Post`, `SocialAccount`,
`BlotatoAccount`, `BlotatoClient`) — through the unmodified Execution Engine
boundary, exactly like the `n8n` tool already is.

## Architecture

```
Agent → Task proposal (social_media_management, MEDIUM risk)
      → approval policy override: this capability always requires approval,
        regardless of risk (approvalPolicy.ts)
      → Execution Engine (createExecutionForTask) re-checks for an APPROVED
        Approval on this exact task before dispatching — never trusts the
        caller or the Task's own status
      → blotatoAdapter.ts (the ONLY module allowed to call BlotatoClient)
      → dryRunPublish() — validates everything, builds the exact request, NEVER sends it
```

`blockos_api` (the graph tool key) is preserved unchanged — no Neo4j edit,
no renaming. The *adapter implementation* backing it is Blotato; the
*logical tool name* the graph and `Task`/`Execution.toolKey` use stays
`blackos_api`, per the explicit instruction to preserve existing graph
contracts absent a concrete correctness reason to change them.

## The Blotato adapter (`src/execution/blotatoAdapter.ts`)

The sole caller of `BlotatoClient` — mirrors `n8nClient.ts`'s "sole caller"
discipline exactly. Three exports:
- `validateAndBuildRequest(postId, agencyId)` — resolves and validates the
  full chain (`Post → SocialAccount → BlotatoAccount`, ownership at every
  hop), returns the exact request that would be sent, or a typed failure
  reason. Never touches the API key.
- `dryRunPublish(postId, agencyId)` — the **only function wired into
  `executionService.ts`**. Calls the above, never makes an HTTP request.
- `publishReal(postId, agencyId)` — **implemented and unit-tested (against
  a mocked Blotato response) but not called from any production code path
  in this phase.** See "Real publish boundary" below.

## Authorization / agency isolation

Every ownership hop is checked independently: `Post.agencyId`,
`SocialAccount → Model.agencyId`, `BlotatoAccount.agencyId` — all three must
match the acting agency. A nonexistent Post and a Post belonging to another
agency return the **identical** `POST_NOT_FOUND` reason (no existence
leak), the same discipline already established by Context Engine's entity
resolution. `createExecutionForTask`'s own unmodified `assertSameAgency`/
`executerTaches` checks run first, unchanged — the adapter's checks are
additional, not a replacement.

## Dry-run safety

`dryRunPublish()` validates the full chain and returns the exact outbound
`BlotatoCreatePostRequest` — but the API key is **never read, decrypted, or
referenced** anywhere in that path (confirmed by a dedicated test asserting
the plaintext test key never appears in the result, and a static guard
confirming `blotatoAdapter.ts` never logs it). The Execution Engine's
`createExecutionForTask` → `blackos_api` branch calls `dryRunPublish()`
**only** — there is no caller-supplied flag that selects real publishing;
the choice is hardcoded at the call site, exactly like `n8n`'s dispatch
hardcodes the one known-safe test workflow rather than accepting a
caller-supplied workflow URL.

## Real publish boundary — explicitly NOT enabled

`publishReal()` exists and is tested (mocked success, mocked API error,
mocked timeout) but **is never invoked by `executionService.ts` or any
other production code path**. A capability-specific approval override
already exists — `social_media_management` always requires an `APPROVED`
Approval regardless of risk level (`CAPABILITIES_REQUIRING_APPROVAL_REGARDLESS_OF_RISK`
in `approvalPolicy.ts`) — but that alone does not make wiring `publishReal()`
in automatic. Enabling real publishing is a separate, explicit decision
still pending: it makes an approval-gated task cause a real, public,
external side effect for the first time in this system, and that step
deliberately requires its own review rather than happening as a byproduct
of an approval-policy change made for a different reason. Until that
decision is made, `publishReal()` remains implemented-but-dormant,
reviewable and testable in isolation, and MUST NOT be imported or called
by `executionService.ts` — enforced by a dedicated static guard test.

## Idempotency

Reuses the existing `Execution` `(taskId, idempotencyKey)` unique
constraint unchanged — a repeated dispatch for the same Task cannot create
a second `Execution` row (proven by a dedicated test). **This guarantees
internal idempotency only.** Blotato's own API (`BlotatoCreatePostRequest`)
has no idempotency key field — if `publishReal()` were ever called twice
for the same content outside of the Execution Engine's own duplicate
protection, Blotato itself would create two separate real posts. This is an
honest, documented limitation, not something this phase solves, and is
moot today since `publishReal()` is unwired.

## Input contract

**Updated:** `postId` is derived from the `Task` row itself
(`task.entityType === "POST" ? task.entityId : null`), never accepted as a
caller-supplied parameter — `createExecutionForTask(taskId, actor)`'s
signature is unchanged from before this capability existed. This closes a
real gap found after the initial implementation: the Orchestrator's own
`createExecutionForTask(taskId, actor)` call sites
(`orchestratorService.ts`, both `continueFromPlan()` and
`resumeOrchestration()`) never had a way to pass an `opts.postId` — so a
`social_media_management` Task could never actually be dispatched through
the only real production path, even after being correctly approval-gated.
Deriving `postId` from the Task row instead — the same "never trust the
caller, always re-derive from the Task row" discipline this function
already documents for tool/workflow/risk/approval — fixes this with zero
changes to `orchestratorService.ts`.

A `social_media_management` Task with no `entityType === "POST"` reference
still fails closed (`Execution`/`Task` → `FAILED`, clear reason) rather
than silently skipping or guessing.

### Entity resolution: how a Task gets its Post reference

`EntityType` (`src/jarvis/types.ts`) now includes `"post"` alongside
`"model"`. `entityResolver.ts`'s `resolveEntities(message, agencyId,
metadata?)` resolves a Post **only** via an explicit `metadata.postId` —
never by free-text matching (a Post has no name to guess from, unlike a
Model). A nonexistent `postId` and one belonging to another agency both
resolve identically to `NOT_FOUND` — the same no-leak discipline as
`blotatoAdapter.ts`'s own Post lookup. `jarvis/core.ts` passes
`request.metadata` through unchanged; `taskService.createTaskFromJarvisPlan`
needed no change at all — its existing `entity.type.toUpperCase()` logic
was already generic.

## Observability

Reuses the existing `WORKFLOW_STARTED`/`WORKFLOW_COMPLETED`/
`WORKFLOW_FAILED` event types unchanged — no new `SystemEventType` value.
The dry-run's sanitized request (no credential) is stored in
`Execution.result`, the same field n8n's own successful executions already
use for their own result payload.

## Tests

`src/execution/__tests__/run.ts` covers: valid resolution, nonexistent/
cross-agency Post (no leak), unsupported source, inactive account, missing
credential, missing content/media, dry-run never touching the API key,
mocked `publishReal()` success/error/timeout, full Execution Engine dispatch
(SUCCEEDED synchronously, correct Events, `fetch` never called),
missing-`postId` failure, cross-agency `postId` failure, duplicate-dispatch
idempotency, and static guards (Agent never imports the adapter/client/
credential functions; `executionService.ts` never imports `BlotatoClient`/
`decryptSecret` directly, and imports `dryRunPublish` rather than
`publishReal` — locking in that dry-run, not real publishing, is the
intended v0.1 dispatch; the adapter never logs the key and accepts no
caller-supplied URL/method).

## Human decision still required

**Real public publishing is NOT enabled.** A capability-specific approval
override already exists for `social_media_management` (see
`approvalPolicy.ts`), but wiring `publishReal()` into `executionService.ts`
is a separate, explicit decision — one this phase deliberately stops short
of, since it is the first point at which an approval-gated task would cause
a real, public, external side effect. This phase implements and tests the
real-publish path in isolation and keeps it unreachable from production
until that decision is made.
