# Social Engine

Owns everything about getting a piece of content onto a social platform and
getting metrics back: OAuth connections, media upload, scheduling,
publishing, retry, and analytics ingestion. It never decides *what* or
*when* to post — that stays human today, and moves to the Agents layer
later. Agents (and other Engines) call this module only through:

- Server Actions under `src/app/(dashboard)/**` for the dashboard UI (session-cookie authed)
- `/api/engine/social/**` for everything else (Bearer `EngineApiKey`, see `src/lib/engineAuth.ts`)

Nothing outside this module should import from `src/engines/social/**`
directly — go through one of the two contracts above. That's what makes this
extractable into its own deployable service later (a `git subtree split` of
this directory plus its API routes) without a rewrite, if/when that becomes
worth the ops overhead.

## Status (Phase 0)

Infra only — no platform adapter yet. `queue/` wires pg-boss to the same
Postgres the rest of the app uses (no Redis) and runs a heartbeat job as a
smoke test. The `worker` container (see `docker/docker-compose.yml`) is what
actually runs `queue/worker.ts`; the `app` container only enqueues.

Full plan, phase-by-phase (Instagram → Facebook → TikTok → YouTube → X/Pinterest → Blotato retirement): see the architecture proposal this module was built from.

## Layering

Same convention as the rest of the app: route/action → service → repository.
`adapters/blotato.adapter.ts` wraps the existing `src/lib/blotato/client.ts`
(untouched) so the legacy Blotato flow and native adapters are
interchangeable behind one `PlatformAdapter` interface — this is what lets a
Model's Instagram connection run on Blotato while another Model's runs
native, with no risk of double-posting (`SocialAccount.source` +
`@@unique([modelId, platform])`).
