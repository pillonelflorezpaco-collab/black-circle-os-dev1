import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { handleN8nCallback } from "@/execution/executionService";

/**
 * The n8n → BlackOS callback for Execution Engine v0.1. Authenticated via
 * WEBHOOK_SHARED_SECRET (a header, not a caller-supplied executionId — see
 * docs/execution-engine.md §8). The Execution is located by
 * (taskId, idempotencyKey), not by trusting the payload's executionId alone.
 *
 * Never logs the secret. Constant-time comparison to avoid a timing
 * side-channel on the secret value.
 */
const bodySchema = z.object({
  executionId: z.string().min(1),
  taskId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  agencyId: z.string().min(1),
  success: z.boolean(),
  summary: z.string().optional(),
});

function isValidSecret(provided: string | null): boolean {
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const provided = req.headers.get("x-webhook-secret");
  if (!isValidSecret(provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await handleN8nCallback(parsed.data);

  switch (result.status) {
    case "NOT_FOUND":
      return NextResponse.json({ error: "No matching execution for (taskId, idempotencyKey)." }, { status: 404 });
    case "MISMATCH":
      return NextResponse.json({ error: result.reason }, { status: 409 });
    case "INVALID_TRANSITION":
      return NextResponse.json({ error: result.reason }, { status: 409 });
    case "OK":
      return NextResponse.json({ status: result.execution.status, alreadyProcessed: result.alreadyProcessed });
  }
}
