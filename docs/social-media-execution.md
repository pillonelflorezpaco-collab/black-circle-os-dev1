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
      → existing risk evaluation (unmodified: MEDIUM → no approval today)
      → Execution Engine (createExecutionForTask, unmodified precondition checks)
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
other production code path**. Wiring it in requires a human decision this
phase does not make:

**Should `social_media_management` (MEDIUM risk) continue to require no
approval once it can cause a real, public, external side effect?** Today's
unmodified policy (`approvalPolicy.ts`) says MEDIUM never requires approval.
Enabling real publishing under that unchanged policy would mean a real post
could go live without a human decision point — this phase deliberately
stops short of that, per the explicit instruction not to reinterpret MEDIUM
risk silently. Until that policy question is answered, `publishReal()`
remains implemented-but-dormant, reviewable and testable in isolation.

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

`createExecutionForTask(taskId, actor, opts?: { postId?: string })` — one
new optional parameter, additive and backward-compatible; the `n8n` path
ignores it entirely. A `social_media_management` Task dispatched without a
`postId` fails closed (`Execution`/`Task` → `FAILED`, clear reason) rather
than silently skipping or guessing.

## Observability

Reuses the existing `WORKFLOW_STARTED`/`WORKFLOW_COMPLETED`/
`WORKFLOW_FAILED` event types unchanged — no new `SystemEventType` value.
The dry-run's sanitized request (no credential) is stored in
`Execution.result`, the same field n8n's own successful executions already
use for their own result payload.

## Tests

35 tests in `src/execution/__tests__/run.ts` (up from 15) cover: valid
resolution, nonexistent/cross-agency Post (no leak), unsupported source,
inactive account, missing credential, missing content/media, dry-run never
touching the API key, mocked `publishReal()` success/error/timeout, full
Execution Engine dispatch (SUCCEEDED synchronously, correct Events, `fetch`
never called), missing-`postId` failure, cross-agency `postId` failure,
duplicate-dispatch idempotency, and three static guards (Agent never
imports the adapter/client/credential functions; `executionService.ts`
never imports `BlotatoClient`/`decryptSecret` directly; the adapter never
logs the key and accepts no caller-supplied URL/method).

## Human decision still required

**Real public publishing is NOT enabled.** Before `publishReal()` can be
wired into `executionService.ts`, someone must decide: does
`social_media_management` need a MEDIUM-risk approval requirement (a
capability-specific policy, or a global MEDIUM-risk policy change), or is
the current no-approval-for-MEDIUM policy intentional even for a real
external side effect? This phase implements everything up to that decision
point and stops there, as instructed.
