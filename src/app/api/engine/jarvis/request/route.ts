import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEngineApiKey } from "@/lib/engineAuth";
import { planJarvisRequest } from "@/jarvis/core";
import { createTaskFromJarvisPlan } from "@/jarvis/taskService";
import { createApprovalForTask } from "@/jarvis/approvalService";
import { taskRepository } from "@/repositories/task.repository";

/**
 * Jarvis Core — orchestration endpoint. Placed under /api/engine/** (not the
 * session-authed dashboard API) because the caller is a future automated
 * actor (Telegram bot → n8n → here), the same shape as the existing
 * /api/engine/social/ping route — reuses the same Bearer/EngineApiKey auth,
 * never a second auth mechanism.
 *
 * mode: "PLAN" (default) always returns a plan and never touches the
 * database. mode: "CREATE_TASK" additionally persists a Task, but ONLY when
 * planJarvisRequest() produced a complete DRY_RUN plan — an incomplete/
 * unresolved plan never creates a task, regardless of mode. Neither mode
 * ever executes anything (see src/jarvis/executionPolicy.ts).
 */
const bodySchema = z.object({
  message: z.string().min(1),
  agencyId: z.string().min(1),
  actorId: z.string().min(1),
  source: z.enum(["internal", "telegram", "engine"]),
  mode: z.enum(["PLAN", "CREATE_TASK"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const key = await verifyEngineApiKey(req);
  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // An engine key scoped to a specific agency may only plan/create tasks for
  // that agency — mirrors the assertSameAgency guard used elsewhere in the app.
  if (key.agencyId && key.agencyId !== parsed.data.agencyId) {
    return NextResponse.json({ error: "Cette clé n'est pas autorisée pour cette agence." }, { status: 403 });
  }

  const mode = parsed.data.mode ?? "PLAN";

  try {
    const plan = await planJarvisRequest(parsed.data);

    if (mode !== "CREATE_TASK" || plan.status !== "DRY_RUN") {
      return NextResponse.json({ status: plan.status, plan, task: null });
    }

    const result = await createTaskFromJarvisPlan(parsed.data, plan);
    if (result.status === "REJECTED") {
      return NextResponse.json({ status: plan.status, plan, task: null, error: result.reason }, { status: 422 });
    }

    // Approval Engine v0.1 — evaluates the just-created Task's risk and, only
    // for HIGH, creates a PENDING Approval + moves the Task to
    // WAITING_APPROVAL. LOW/MEDIUM leave the Task as PLANNED with no Approval
    // record. Never executes anything either way (docs/approval-engine.md).
    const approvalDecision = await createApprovalForTask(result.task.id, parsed.data.actorId);
    const finalTask = approvalDecision.approval ? await taskRepository.findById(result.task.id) : result.task;

    return NextResponse.json({
      status: "TASK_CREATED",
      plan,
      task: finalTask,
      approval: approvalDecision.approval,
      execution: { allowed: false },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
