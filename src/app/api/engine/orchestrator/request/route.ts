import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEngineApiKey } from "@/lib/engineAuth";
import { prisma } from "@/lib/prisma";
import { startOrchestration } from "@/orchestrator/orchestratorService";
import type { StartOrchestrationResult } from "@/orchestrator/types";

/**
 * Jarvis Orchestrator v0.1c — the ONE HTTP entry point for startOrchestration().
 * Same Bearer/EngineApiKey auth as the rest of /api/engine/** (see
 * /api/engine/jarvis/request and /api/engine/executions/trigger) — no second
 * authentication mechanism is introduced.
 *
 * This route is a thin adapter: authenticate → validate → authorize → call
 * startOrchestration() → map the result → respond. It does not call
 * planJarvisRequest/createTaskFromJarvisPlan/createApprovalForTask/
 * createExecutionForTask directly, does not touch n8n or Neo4j, and does
 * not read/write Prisma beyond the one actor lookup below (the same lookup
 * /api/engine/executions/trigger already performs for the same reason: to
 * resolve the authenticated caller's real Role/agencyId, never trusting a
 * role or agency the request body might claim).
 *
 * EngineApiKey.scopes exists in the schema but is not enforced by any
 * existing /api/engine/** route today — this route intentionally does not
 * introduce scope enforcement here either, to avoid inventing a parallel
 * authorization mechanism inconsistent with the two routes it mirrors. See
 * docs/orchestrator.md "V0.1c — HTTP entry point" for the deviation note.
 */
const bodySchema = z.object({
  message: z.string().min(1),
  agencyId: z.string().min(1),
  actorId: z.string().min(1),
  source: z.enum(["internal", "telegram", "engine"]),
  requestId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const key = await verifyEngineApiKey(req);
  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Agency authorization — mirrors the exact same check already used by
  // /api/engine/jarvis/request and /api/engine/executions/trigger. The
  // request body's agencyId is never trusted on its own; an agency-scoped
  // key may only request orchestration for its own agency.
  if (key.agencyId && key.agencyId !== parsed.data.agencyId) {
    return NextResponse.json({ error: "Cette clé n'est pas autorisée pour cette agence." }, { status: 403 });
  }

  // Actor identity is resolved from the real User row, never from a role or
  // agencyId the request body might claim — same pattern as
  // /api/engine/executions/trigger.
  const actor = await prisma.user.findUnique({ where: { id: parsed.data.actorId }, select: { id: true, role: true, agencyId: true } });
  if (!actor) {
    return NextResponse.json({ error: "actorId does not reference a real user." }, { status: 400 });
  }
  if (key.agencyId && actor.agencyId && key.agencyId !== actor.agencyId) {
    return NextResponse.json({ error: "Cette clé n'est pas autorisée pour cet acteur." }, { status: 403 });
  }

  try {
    const result = await startOrchestration(parsed.data, actor);
    return NextResponse.json(toResponse(result), { status: 200 });
  } catch {
    // Deliberately generic — see docs/orchestrator.md "Error sanitization".
    // The real error is not logged here beyond what startOrchestration's own
    // callees already log via the existing console logging convention
    // (src/jarvis/core.ts's log()), which never includes secrets.
    return NextResponse.json({ error: "Internal orchestration error." }, { status: 500 });
  }
}

/** Thin response — never the raw Prisma OrchestrationRecord, never a Task/Approval/Execution object. */
function toResponse(result: StartOrchestrationResult) {
  return {
    orchestrationId: result.orchestration.id,
    requestId: result.orchestration.requestId,
    state: result.orchestration.state,
    taskId: result.orchestration.taskId,
    approvalId: result.orchestration.approvalId,
    executionId: result.orchestration.executionId,
  };
}
