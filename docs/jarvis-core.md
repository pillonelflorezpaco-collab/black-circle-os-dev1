# Jarvis Core — DRY-RUN orchestration engine

First implementation phase. Jarvis Core is **read/plan only**: it reads
PostgreSQL (business entities, coarse role) and Neo4j (organizational graph —
see `/opt/neo4j/README.md`), and returns a structured orchestration plan. It
never calls n8n, never sends messages, never mutates business data, and
`executionAllowed` is hardcoded `false` in `src/jarvis/executionPolicy.ts` —
the single place that decides it, so it can't accidentally become `true`
anywhere else in the pipeline.

## Pipeline

`src/jarvis/core.ts` — `planJarvisRequest()`:

```
REQUEST → NORMALIZE → PERMISSION (coarse) → UNDERSTAND (intent) →
ENTITY RESOLUTION (Postgres) → ORGANIZATIONAL/CAPABILITY/AGENT/TOOL
RESOLUTION (Neo4j) → RISK EVALUATION → PLAN
```

Each stage can short-circuit to `NEEDS_CLARIFICATION` or `UNKNOWN_INTENT`
rather than guess — see `src/jarvis/types.ts` for the full `JarvisPlan` shape.

## Modules

| File | Responsibility |
|---|---|
| `src/jarvis/types.ts` | Request/plan contracts |
| `src/jarvis/intentResolver.ts` | Deterministic keyword → capability mapping (placeholder for a future LLM layer — same function signature) |
| `src/jarvis/entityResolver.ts` | Exact-match Model lookup in Postgres, scoped by agency; excludes known Platform names (Instagram, TikTok, …) so they aren't mistaken for a Model reference |
| `src/jarvis/neo4jClient.ts` | Singleton read-only Neo4j driver (same caching pattern as `src/lib/prisma.ts`) |
| `src/jarvis/graphResolver.ts` | Reads department/agent/capability/tool from the existing Neo4j graph — never writes |
| `src/jarvis/executionPolicy.ts` | The one place `executionAllowed`/`approvalRequired` is decided (always `false` in this phase) |

## API

`POST /api/engine/jarvis/request` — reuses the existing `EngineApiKey` Bearer
auth (`src/lib/engineAuth.ts`, same as `/api/engine/social/ping`), not a
second auth mechanism. Body: `{ message, agencyId, actorId, source, metadata? }`.
An agency-scoped key may only plan for its own agency.

## Configuration

`NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` in `.env` (internal Docker
network only, `bolt://neo4j:7687`; never exposed publicly). The `app` and
`worker` Compose services now also join `automation-stack_automation_net`
(external network) so they can reach the `neo4j` container — see
`docker/docker-compose.yml`.

## Permissions boundary

The fine-grained Neo4j `HAS_ACCESS` permission layer is **not seeded**
(`/opt/neo4j/README.md` §9). Every plan reports
`permissions.fineGrainedAuthorization: "NOT_IMPLEMENTED"` explicitly rather
than silently skipping the check or pretending it passed. Only the existing
coarse Postgres check (actor belongs to the request's agency, or is
`SUPER_ADMIN`) gates a request today.

## Tests

`src/jarvis/__tests__/run.ts`, run via `npm run test:jarvis` (plain
`node:assert` script executed with `tsx` — the same tool the repo already
uses for `prisma db seed`; no new test framework dependency was added).
Covers all four capabilities, unresolved/ambiguous entity handling, unknown
intent, correct department/agent/capability/risk/tool resolution,
`executionAllowed` always `false`, and zero side effects on
`Event`/`ActivityLogEntry`/`Video`/`Post` row counts across the run.

## Intentionally NOT implemented in this phase

Telegram integration, real n8n execution, Graphiti, autonomous LLM reasoning,
`Task`/`Approval` records, real permission edges, a BlackOS frontend for
Jarvis, and any device/social-media automation.

## Next step

Seed one real `HAS_ACCESS` permission edge (pending the confirmation already
requested in `/opt/neo4j/README.md` §9), then add `Task`/`Approval` Postgres
tables and wire an actual approval flow for `MEDIUM`/`HIGH`-risk capabilities
— still without touching n8n execution or Telegram.
