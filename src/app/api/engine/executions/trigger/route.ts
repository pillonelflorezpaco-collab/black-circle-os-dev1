import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEngineApiKey } from "@/lib/engineAuth";
import { prisma } from "@/lib/prisma";
import { createExecutionForTask } from "@/execution/executionService";

/**
 * The smallest safe machine endpoint to trigger an Execution — EngineApiKey
 * Bearer-authed, same pattern as the rest of /api/engine/**. Does NOT accept
 * a workflow URL, tool, or risk level from the caller: only `taskId` and
 * `actorId` (a real User, checked against the key's agency scope). Every
 * other value is resolved authoritatively inside createExecutionForTask()
 * (see docs/execution-engine.md §5).
 */
const bodySchema = z.object({
  taskId: z.string().min(1),
  actorId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const key = await verifyEngineApiKey(req);
  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actor = await prisma.user.findUnique({ where: { id: parsed.data.actorId }, select: { id: true, role: true, agencyId: true } });
  if (!actor) {
    return NextResponse.json({ error: "actorId does not reference a real user." }, { status: 400 });
  }

  // An agency-scoped engine key may only trigger executions for actors in
  // that same agency — mirrors the assertSameAgency guard used elsewhere.
  if (key.agencyId && actor.agencyId && key.agencyId !== actor.agencyId) {
    return NextResponse.json({ error: "Cette clé n'est pas autorisée pour cet acteur." }, { status: 403 });
  }

  const result = await createExecutionForTask(parsed.data.taskId, actor);

  switch (result.status) {
    case "NOT_FOUND":
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    case "FORBIDDEN":
      return NextResponse.json({ error: result.reason }, { status: 403 });
    case "INVALID_STATE":
      return NextResponse.json({ error: result.reason }, { status: 409 });
    case "APPROVAL_REQUIRED":
      return NextResponse.json({ error: result.reason }, { status: 409 });
    case "UNSUPPORTED_TOOL":
      return NextResponse.json({ error: result.reason }, { status: 422 });
    case "CREATED":
      return NextResponse.json({ execution: result.execution });
  }
}
